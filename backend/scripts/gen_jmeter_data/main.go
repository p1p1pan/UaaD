// gen_jmeter_data 在 API 已启动时生成 JMeter 用 jmeter_users.csv（token + activity_id）。
//
// 推荐压测前：go run ./scripts/gen_jmeter_data -count 1000
//
// 说明：服务端 /auth/register 有 IP 限流（默认约每分钟 5 次）。批量注册须顺序请求并在 429 时退避；
// 但本地ip(127.0.0.1, ::1)不进行限流
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	base := flag.String("base", "http://localhost:8080", "API 根地址")
	password := flag.String("password", "test123456", "注册与登录共用密码")
	phones := flag.String("phones", "", "逗号分隔手机号；非空时仅使用这些用户，不批量注册")
	count := flag.Int("count", 0, "批量生成用户数（与 -phones 二选一）；会注册 18900000000 起连续号码并登录，建议与 JMeter 线程数一致")
	loginWorkers := flag.Int("login-workers", 32, "仅登录阶段并发数（注册接口限流，始终顺序+退避）")
	backoff429 := flag.Duration("429-backoff", 13*time.Second, "注册遇 HTTP 429 时等待多久再重试（应略大于令牌桶补充间隔）")
	max429Retries := flag.Int("429-retries", 40, "同一号码注册遇 429 时最多重试次数")
	out := flag.String("out", "./tests/jmeter/out/jmeter_users.csv", "输出 CSV 路径（相对 backend/，默认在 out/ 下）")
	flag.Parse()

	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	client := &http.Client{Timeout: 60 * time.Second}

	activityID, err := pickPublishedActivityID(client, *base)
	if err != nil {
		fmt.Fprintf(os.Stderr, "获取活动 ID 失败: %v\n", err)
		os.Exit(1)
	}

	var phoneList []string
	if strings.TrimSpace(*phones) != "" {
		phoneList = splitPhones(*phones)
		if len(phoneList) == 0 {
			fmt.Fprintln(os.Stderr, "phones 解析为空")
			os.Exit(1)
		}
	} else if *count > 0 {
		phoneList = make([]string, *count)
		for i := 0; i < *count; i++ {
			phoneList[i] = fmt.Sprintf("189%08d", i)
		}
	} else {
		fmt.Fprintln(os.Stderr, "请指定 -phones 或 -count（例如 -count 1000）")
		os.Exit(1)
	}

	// 阶段 1：注册（仅 -count 模式）。服务端对 /register 限流，必须顺序请求 + 429 退避。
	if *count > 0 {
		for i, phone := range phoneList {
			user := fmt.Sprintf("jm_%s", phone)
			if err := registerWithRetry(client, *base, phone, user, *password, *backoff429, *max429Retries); err != nil {
				fmt.Fprintf(os.Stderr, "失败: %v\n", err)
				os.Exit(1)
			}
			if (i+1)%50 == 0 || i == len(phoneList)-1 {
				fmt.Fprintf(os.Stderr, "注册进度 %d / %d\n", i+1, len(phoneList))
			}
		}
	}

	// 阶段 2：登录（不限流）可并发取 token
	tokens := make([]string, len(phoneList))
	var wg sync.WaitGroup
	errMu := sync.Mutex{}
	var firstErr error
	sem := make(chan struct{}, *loginWorkers)

	for i, phone := range phoneList {
		wg.Add(1)
		i, phone := i, phone
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			tok, err := login(client, *base, phone, *password)
			if err != nil {
				errMu.Lock()
				if firstErr == nil {
					firstErr = fmt.Errorf("登录 %s: %w", phone, err)
				}
				errMu.Unlock()
				return
			}
			tokens[i] = tok
		}()
	}
	wg.Wait()
	if firstErr != nil {
		fmt.Fprintf(os.Stderr, "失败: %v\n", firstErr)
		os.Exit(1)
	}

	var rows []string
	rows = append(rows, "token,activity_id")
	for _, tok := range tokens {
		if tok == "" {
			fmt.Fprintln(os.Stderr, "内部错误: 存在空 token")
			os.Exit(1)
		}
		rows = append(rows, tok+","+activityID)
	}

	content := strings.Join(rows, "\n") + "\n"
	if dir := filepath.Dir(*out); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Fprintf(os.Stderr, "创建目录失败: %v\n", err)
			os.Exit(1)
		}
	}
	if err := os.WriteFile(*out, []byte(content), 0600); err != nil {
		fmt.Fprintf(os.Stderr, "写入 %s 失败: %v\n", *out, err)
		os.Exit(1)
	}
	fmt.Printf("已写入 %s（%d 行 token，activity_id=%s）\n", *out, len(phoneList), activityID)
}

func splitPhones(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

type envelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type loginData struct {
	Token string `json:"token"`
}

type listActivitiesData struct {
	List []struct {
		ID            uint64    `json:"id"`
		Status        string    `json:"status"`
		EnrollOpenAt  time.Time `json:"enroll_open_at"`
		EnrollCloseAt time.Time `json:"enroll_close_at"`
	} `json:"list"`
}

func registerWithRetry(client *http.Client, base, phone, username, password string, backoff time.Duration, maxRetries int) error {
	for attempt := 0; attempt < maxRetries; attempt++ {
		code, body, err := registerStatus(client, base, phone, username, password)
		if err != nil {
			return fmt.Errorf("注册 %s: %w", phone, err)
		}
		switch code {
		case http.StatusCreated, http.StatusOK:
			return nil
		case http.StatusConflict:
			return nil
		case http.StatusTooManyRequests:
			if attempt+1 == maxRetries {
				return fmt.Errorf("注册 %s: HTTP 429 重试耗尽: %s", phone, body)
			}
			fmt.Fprintf(os.Stderr, "注册 %s 遇 429，%v 后重试 (%d/%d)…\n", phone, backoff, attempt+1, maxRetries)
			time.Sleep(backoff)
			continue
		default:
			return fmt.Errorf("注册 %s: HTTP %d: %s", phone, code, body)
		}
	}
	return fmt.Errorf("注册 %s: 重试耗尽", phone)
}

func registerStatus(client *http.Client, base, phone, username, password string) (int, string, error) {
	body := fmt.Sprintf(`{"phone":"%s","username":"%s","password":"%s"}`, phone, username, password)
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(base, "/")+"/api/v1/auth/register", strings.NewReader(body))
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b), nil
}

func login(client *http.Client, base, phone, password string) (string, error) {
	body := fmt.Sprintf(`{"phone":"%s","password":"%s"}`, phone, password)
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(base, "/")+"/api/v1/auth/login", strings.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}
	var env envelope
	if err := json.Unmarshal(b, &env); err != nil {
		return "", err
	}
	var ld loginData
	if err := json.Unmarshal(env.Data, &ld); err != nil {
		return "", fmt.Errorf("解析 data: %w", err)
	}
	if ld.Token == "" {
		return "", fmt.Errorf("data.token 为空")
	}
	return ld.Token, nil
}

func pickPublishedActivityID(client *http.Client, base string) (string, error) {
	url := strings.TrimRight(base, "/") + "/api/v1/activities?page=1&page_size=100"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}
	var env envelope
	if err := json.Unmarshal(b, &env); err != nil {
		return "", err
	}
	var data listActivitiesData
	if err := json.Unmarshal(env.Data, &data); err != nil {
		return "", err
	}
	for _, a := range data.List {
		if strings.EqualFold(a.Status, "PUBLISHED") {
			now := time.Now()
			if !a.EnrollOpenAt.IsZero() && !a.EnrollCloseAt.IsZero() {
				if now.Before(a.EnrollOpenAt) || now.After(a.EnrollCloseAt) {
					continue // 报名窗口未开放或已关闭
				}
			}
			return fmt.Sprintf("%d", a.ID), nil
		}
	}
	return "", fmt.Errorf("列表中无报名窗口当前开放的 PUBLISHED 活动，请先创建活动并确认 enroll_open_at/enroll_close_at 覆盖当前时间")
}
