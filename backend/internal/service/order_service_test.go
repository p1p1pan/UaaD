package service

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateOrderNo_Format(t *testing.T) {
	orderNo := GenerateOrderNo()

	if !strings.HasPrefix(orderNo, "ORD") {
		t.Errorf("order number should start with ORD, got %s", orderNo)
	}

	today := time.Now().Format("20060102")
	if !strings.HasPrefix(orderNo, "ORD"+today) {
		t.Errorf("order number should contain today's date %s, got %s", today, orderNo)
	}

	// ORD + 8-digit date + 8-digit seq = 19 chars
	if len(orderNo) != 19 {
		t.Errorf("order number should be 19 chars, got %d: %s", len(orderNo), orderNo)
	}
}

func TestGenerateOrderNo_Unique(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		no := GenerateOrderNo()
		if seen[no] {
			t.Fatalf("duplicate order number: %s", no)
		}
		seen[no] = true
	}
}

func TestGenerateOrderNo_Concurrent(t *testing.T) {
	const n = 1000
	results := make(chan string, n)
	for i := 0; i < n; i++ {
		go func() {
			results <- GenerateOrderNo()
		}()
	}

	seen := make(map[string]bool)
	for i := 0; i < n; i++ {
		no := <-results
		if seen[no] {
			t.Fatalf("concurrent duplicate: %s", no)
		}
		seen[no] = true
	}
}
