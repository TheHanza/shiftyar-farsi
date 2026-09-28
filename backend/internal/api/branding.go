package api

import (
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"

	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

const (
	logoKey     = "logo"
	maxLogoSize = 1 << 20 // 1 MB; the UI downsizes images before uploading
)

// Raster formats only: SVG can carry scripts, so it is rejected.
var logoTypes = map[string]bool{"image/png": true, "image/jpeg": true, "image/webp": true, "image/gif": true}

// branding is public so the login page can show the company's name and logo.
func (s *Server) branding(c *gin.Context) {
	st := s.settings()
	c.JSON(http.StatusOK, gin.H{"companyName": st.CompanyName, "logoVersion": st.LogoVersion})
}

func (s *Server) logo(c *gin.Context) {
	var a models.Asset
	if s.db.First(&a, "key = ?", logoKey).Error != nil {
		c.Status(http.StatusNotFound)
		return
	}
	// URLs carry ?v=<logoVersion>, so a versioned response never changes.
	if c.Query("v") != "" {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		c.Header("Cache-Control", "no-cache")
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(http.StatusOK, a.ContentType, a.Data)
}

func (s *Server) uploadLogo(c *gin.Context) {
	file, err := c.FormFile("logo")
	if err != nil {
		fail(c, http.StatusBadRequest, "فایل لوگو ارسال نشده")
		return
	}
	if file.Size > maxLogoSize {
		fail(c, http.StatusBadRequest, "حجم لوگو باید کمتر از ۱ مگابایت باشد")
		return
	}
	f, err := file.Open()
	if err != nil {
		fail(c, http.StatusBadRequest, "فایل قابل خواندن نیست")
		return
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxLogoSize+1))
	if err != nil || len(data) > maxLogoSize {
		fail(c, http.StatusBadRequest, "حجم لوگو باید کمتر از ۱ مگابایت باشد")
		return
	}
	// Trust the bytes, not the client's declared type.
	ctype := http.DetectContentType(data)
	if !logoTypes[ctype] {
		fail(c, http.StatusBadRequest, "فقط تصویر PNG، JPG، WebP یا GIF قبول است")
		return
	}
	asset := models.Asset{Key: logoKey, ContentType: ctype, Data: data}
	if err := s.db.Clauses(clause.OnConflict{UpdateAll: true}).Create(&asset).Error; err != nil {
		fail(c, http.StatusInternalServerError, "خطای داخلی")
		return
	}
	version := time.Now().UnixMilli()
	s.db.Model(&models.Settings{}).Where("id = ?", 1).Update("logo_version", version)
	c.JSON(http.StatusOK, gin.H{"logoVersion": version})
}

func (s *Server) deleteLogo(c *gin.Context) {
	s.db.Delete(&models.Asset{}, "key = ?", logoKey)
	s.db.Model(&models.Settings{}).Where("id = ?", 1).Update("logo_version", 0)
	c.JSON(http.StatusOK, gin.H{"logoVersion": 0})
}
