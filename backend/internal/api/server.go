package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/Bazi-Digital/shift-app/backend/internal/config"
	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

// Version is reported by /api/health so deploys can verify what is running.
var Version = "dev"

type Server struct {
	db      *gorm.DB
	cfg     config.Config
	limiter *loginLimiter
}

func NewRouter(db *gorm.DB, cfg config.Config) *gin.Engine {
	s := &Server{db: db, cfg: cfg, limiter: newLoginLimiter(10, 5*time.Minute)}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		panic(err)
	}
	if len(cfg.CORSOrigins) > 0 {
		r.Use(cors(cfg.CORSOrigins))
	}

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		if sqlDB, err := s.db.DB(); err != nil || sqlDB.PingContext(c) != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false, "version": Version})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "version": Version})
	})
	api.POST("/auth/login", s.login)
	api.GET("/branding", s.branding)
	api.GET("/logo", s.logo)

	authed := api.Group("", s.requireAuth)
	authed.GET("/me", s.getMe)
	authed.PATCH("/me", s.updateMe)
	authed.GET("/summary", s.getSummary)
	authed.GET("/shifts", s.listShifts)
	authed.POST("/shifts", s.createShift)
	authed.PATCH("/shifts/:id", s.updateShift)
	authed.DELETE("/shifts/:id", s.deleteShift)
	authed.GET("/shifts/active", s.activeShift)
	authed.POST("/shifts/clock-in", s.clockIn)
	authed.POST("/shifts/clock-out", s.clockOut)
	authed.GET("/coverage", s.coverage)
	authed.GET("/leaderboard", s.leaderboard)

	admin := authed.Group("/admin", s.requireAdmin)
	admin.GET("/users", s.listUsers)
	admin.POST("/users", s.createUser)
	admin.PATCH("/users/:id", s.updateUser)
	admin.POST("/channels", s.createChannel)
	admin.PATCH("/channels/:id", s.updateChannel)
	admin.GET("/rules", s.listRules)
	admin.POST("/rules", s.createRule)
	admin.PATCH("/rules/:id", s.updateRule)
	admin.DELETE("/rules/:id", s.deleteRule)
	admin.PUT("/settings", s.updateSettings)
	admin.POST("/logo", s.uploadLogo)
	admin.DELETE("/logo", s.deleteLogo)
	admin.GET("/adjustments", s.listAdjustments)
	admin.POST("/adjustments", s.createAdjustment)
	admin.DELETE("/adjustments/:id", s.deleteAdjustment)
	admin.POST("/shifts/review", s.reviewShifts)
	admin.GET("/live", s.live)
	admin.GET("/report", s.report)
	admin.GET("/report.csv", s.reportCSV)

	if cfg.StaticDir != "" {
		serveSPA(r, cfg.StaticDir)
	}
	return r
}

// serveSPA serves the built frontend, falling back to index.html for client routes.
func serveSPA(r *gin.Engine, dir string) {
	index := filepath.Join(dir, "index.html")
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "یافت نشد"})
			return
		}
		p := filepath.Join(dir, filepath.Clean("/"+c.Request.URL.Path))
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			if strings.HasPrefix(c.Request.URL.Path, "/assets/") {
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			c.File(p)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.File(index)
	})
}

func cors(origins []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[strings.TrimSpace(o)] = true
	}
	return func(c *gin.Context) {
		if o := c.GetHeader("Origin"); allowed[o] {
			c.Header("Access-Control-Allow-Origin", o)
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func (s *Server) settings() models.Settings {
	var st models.Settings
	s.db.First(&st, 1)
	return st
}

func (s *Server) location(st models.Settings) *time.Location {
	if loc, err := time.LoadLocation(st.Timezone); err == nil {
		return loc
	}
	return time.UTC
}
