package config

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"strings"
)

type Config struct {
	Port          string
	DBDriver      string // "sqlite" or "postgres"
	DBDSN         string
	JWTSecret     []byte
	AdminUsername string
	AdminPassword string
	AdminName     string
	StaticDir     string
	CORSOrigins   []string
	// TrustedProxies may set X-Forwarded-For (the reverse proxy / Docker bridge).
	TrustedProxies []string
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func Load() Config {
	c := Config{
		Port:          env("PORT", "8080"),
		DBDriver:      env("DB_DRIVER", "sqlite"),
		DBDSN:         env("DB_DSN", "data/shiftyar.db"),
		AdminUsername: env("ADMIN_USERNAME", ""),
		AdminPassword: env("ADMIN_PASSWORD", ""),
		AdminName:     env("ADMIN_NAME", "مدیر"),
		StaticDir:     env("STATIC_DIR", ""),
	}
	c.TrustedProxies = strings.Split(env("TRUSTED_PROXIES", "127.0.0.1/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"), ",")
	if o := env("CORS_ORIGINS", ""); o != "" {
		c.CORSOrigins = strings.Split(o, ",")
	}
	secret := env("JWT_SECRET", "")
	if secret == "" {
		b := make([]byte, 32)
		_, _ = rand.Read(b)
		secret = hex.EncodeToString(b)
		log.Println("WARNING: JWT_SECRET is not set; using a random secret (sessions reset on restart)")
	}
	c.JWTSecret = []byte(secret)
	return c
}
