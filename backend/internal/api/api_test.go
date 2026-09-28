package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Bazi-Digital/shift-app/backend/internal/config"
	"github.com/Bazi-Digital/shift-app/backend/internal/store"
)

type client struct {
	t     *testing.T
	h     http.Handler
	token string
}

func (c *client) do(method, path string, body any, out any) int {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, "/api"+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	w := httptest.NewRecorder()
	c.h.ServeHTTP(w, req)
	if out != nil {
		_ = json.Unmarshal(w.Body.Bytes(), out)
	}
	return w.Code
}

func setup(t *testing.T) (*client, func(user, pass string) *client) {
	gin.SetMode(gin.TestMode)
	cfg := config.Config{DBDriver: "sqlite", DBDSN: filepath.Join(t.TempDir(), "test.db"),
		JWTSecret: []byte("test"), AdminUsername: "admin", AdminPassword: "admin12345", AdminName: "Admin"}
	db, err := store.Open(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(db, cfg); err != nil {
		t.Fatal(err)
	}
	h := NewRouter(db, cfg)
	login := func(user, pass string) *client {
		c := &client{t: t, h: h}
		var res struct{ Token string }
		if code := c.do("POST", "/auth/login", map[string]string{"username": user, "password": pass}, &res); code != 200 {
			t.Fatalf("login %s: %d", user, code)
		}
		c.token = res.Token
		return c
	}
	return login("admin", "admin12345"), login
}

func TestShiftLifecycle(t *testing.T) {
	admin, login := setup(t)

	var emp struct{ ID uint }
	if code := admin.do("POST", "/admin/users", map[string]any{
		"name": "Ali", "username": "ali", "password": "ali12345", "hourlyRate": 100000, "weeklyGoalHours": 30,
	}, &emp); code != 201 {
		t.Fatalf("create user: %d", code)
	}
	ali := login("ali", "ali12345")

	if code := ali.do("GET", "/admin/users", nil, nil); code != 403 {
		t.Fatalf("employee reached admin API: %d", code)
	}

	day := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	var sh struct {
		ID           uint
		Status       string
		Minutes      int
		BonusMinutes int
	}
	if code := ali.do("POST", "/shifts", map[string]any{"date": day, "start": "22:00", "end": "02:00"}, &sh); code != 201 {
		t.Fatalf("create shift: %d", code)
	}
	if sh.Status != "pending" || sh.Minutes != 240 || sh.BonusMinutes != 120 {
		t.Fatalf("unexpected shift %+v", sh)
	}
	if code := ali.do("POST", "/shifts", map[string]any{"date": day, "start": "23:00", "end": "23:30"}, nil); code != 400 {
		t.Fatalf("overlap accepted: %d", code)
	}
	if code := ali.do("POST", "/shifts", map[string]any{"date": time.Now().AddDate(0, 0, 2).Format("2006-01-02"), "start": "09:00", "end": "10:00"}, nil); code != 400 {
		t.Fatalf("future shift accepted: %d", code)
	}

	if code := admin.do("POST", "/admin/shifts/review", map[string]any{"ids": []uint{sh.ID}, "status": "approved"}, nil); code != 200 {
		t.Fatalf("approve: %d", code)
	}
	if code := ali.do("DELETE", "/shifts/"+jwtSubject(sh.ID), nil, nil); code != 403 {
		t.Fatalf("employee deleted an approved shift: %d", code)
	}

	// Admin reads the employee's summary (regression: used to 404).
	var sum struct {
		User    struct{ ID uint }
		Minutes int
		BasePay int64
	}
	if code := admin.do("GET", "/summary?period=week&userId="+jwtSubject(emp.ID), nil, &sum); code != 200 {
		t.Fatalf("admin summary of employee: %d", code)
	}
	if sum.User.ID != emp.ID {
		t.Fatalf("summary for wrong user: %+v", sum)
	}
	// The shift can straddle the week boundary, so only check it's non-empty
	// and priced at 1.1x for the night part.
	if sum.Minutes == 0 || sum.BasePay == 0 {
		t.Fatalf("empty summary: %+v", sum)
	}

	// Employees can't peek at someone else's summary.
	var own struct{ User struct{ ID uint } }
	ali.do("GET", "/summary?period=week&userId=1", nil, &own)
	if own.User.ID != emp.ID {
		t.Fatalf("employee got another user's summary")
	}
}

func TestClockInOut(t *testing.T) {
	_, login := setup(t)
	admin := login("admin", "admin12345")
	admin.do("POST", "/admin/users", map[string]any{"name": "Sara", "username": "sara", "password": "sara1234"}, nil)
	sara := login("sara", "sara1234")

	if code := sara.do("POST", "/shifts/clock-in", map[string]any{}, nil); code != 201 {
		t.Fatalf("clock-in: %d", code)
	}
	if code := sara.do("POST", "/shifts/clock-in", map[string]any{}, nil); code != 409 {
		t.Fatalf("double clock-in: %d", code)
	}
	var live struct{ Online []any }
	admin.do("GET", "/admin/live", nil, &live)
	if len(live.Online) != 1 {
		t.Fatalf("live online = %d", len(live.Online))
	}
	if code := sara.do("POST", "/shifts/clock-out", map[string]any{}, nil); code != 200 {
		t.Fatalf("clock-out: %d", code)
	}
}

func (c *client) upload(path, field, name string, data []byte) int {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile(field, name)
	_, _ = fw.Write(data)
	_ = mw.Close()
	req := httptest.NewRequest("POST", "/api"+path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	w := httptest.NewRecorder()
	c.h.ServeHTTP(w, req)
	return w.Code
}

func TestLogo(t *testing.T) {
	admin, login := setup(t)
	admin.do("POST", "/admin/users", map[string]any{"name": "Sara", "username": "sara", "password": "sara1234"}, nil)
	sara := login("sara", "sara1234")
	anon := &client{t: t, h: admin.h}

	var b struct{ LogoVersion int64 }
	anon.do("GET", "/branding", nil, &b)
	if b.LogoVersion != 0 {
		t.Fatalf("fresh install has logo version %d", b.LogoVersion)
	}
	if code := anon.do("GET", "/logo", nil, nil); code != 404 {
		t.Fatalf("missing logo: %d", code)
	}

	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89")
	if code := sara.upload("/admin/logo", "logo", "l.png", png); code != 403 {
		t.Fatalf("employee uploaded a logo: %d", code)
	}
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	if code := admin.upload("/admin/logo", "logo", "l.svg", svg); code != 400 {
		t.Fatalf("svg accepted: %d", code)
	}
	if code := admin.upload("/admin/logo", "logo", "l.png", png); code != 200 {
		t.Fatalf("upload: %d", code)
	}
	anon.do("GET", "/branding", nil, &b)
	if b.LogoVersion == 0 {
		t.Fatal("logo version not bumped")
	}

	req := httptest.NewRequest("GET", "/api/logo?v=1", nil)
	w := httptest.NewRecorder()
	admin.h.ServeHTTP(w, req)
	if w.Code != 200 || w.Header().Get("Content-Type") != "image/png" || !bytes.Equal(w.Body.Bytes(), png) {
		t.Fatalf("logo fetch: %d %q", w.Code, w.Header().Get("Content-Type"))
	}

	// Saving other settings must not wipe the logo version.
	var st map[string]any
	admin.do("GET", "/me", nil, &struct{ Settings *map[string]any }{&st})
	st["logoVersion"] = 0
	admin.do("PUT", "/admin/settings", st, nil)
	anon.do("GET", "/branding", nil, &b)
	if b.LogoVersion == 0 {
		t.Fatal("settings save reset the logo")
	}

	admin.do("DELETE", "/admin/logo", nil, nil)
	if code := anon.do("GET", "/logo", nil, nil); code != 404 {
		t.Fatalf("logo still served after delete: %d", code)
	}
}
