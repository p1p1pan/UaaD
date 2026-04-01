package service

import (
	"errors"
	"time"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
	"github.com/uaad/backend/pkg/jwtutil"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// AuthLoginResult represents the response data returned on successful login.
type AuthLoginResult struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	UserID    uint64    `json:"user_id"`
	Role      string    `json:"role"`
	Username  string    `json:"username"`
}

// AuthService defines the authentication business logic interface.
type AuthService interface {
	Register(phone, username, password string) error
	Login(phone, password string) (*AuthLoginResult, error)
	GetProfile(userID uint64) (*domain.User, error)
}

type authService struct {
	repo   repository.UserRepository
	secret string
}

// NewAuthService creates a new AuthService.
func NewAuthService(repo repository.UserRepository, secret string) AuthService {
	return &authService{
		repo:   repo,
		secret: secret,
	}
}

func (s *authService) Register(phone, username, password string) error {
	_, err := s.repo.FindByPhone(phone)
	if err == nil {
		return ErrUserAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := &domain.User{
		Phone:        phone,
		Username:     username,
		PasswordHash: string(hash),
	}

	return s.repo.Create(user)
}

func (s *authService) Login(phone, password string) (*AuthLoginResult, error) {
	user, err := s.repo.FindByPhone(phone)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	expireDuration := 72 * time.Hour
	token, err := jwtutil.GenerateToken(user.ID, user.Role, s.secret, expireDuration)
	if err != nil {
		return nil, err
	}

	return &AuthLoginResult{
		Token:     token,
		ExpiresAt: time.Now().Add(expireDuration),
		UserID:    user.ID,
		Role:      user.Role,
		Username:  user.Username,
	}, nil
}

func (s *authService) GetProfile(userID uint64) (*domain.User, error) {
	return s.repo.FindByID(userID)
}
