package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // embed zone data so Asia/Tehran works in minimal containers

	"github.com/gin-gonic/gin"

	"github.com/Bazi-Digital/shift-app/backend/internal/api"
	"github.com/Bazi-Digital/shift-app/backend/internal/config"
	"github.com/Bazi-Digital/shift-app/backend/internal/store"
)

// version is stamped at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	demo := flag.Bool("demo", false, "seed sample employees and shifts into an empty database")
	flag.Parse()
	cfg := config.Load()
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := store.Open(cfg)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	if err := store.Migrate(db, cfg); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if *demo {
		if err := store.SeedDemo(db); err != nil {
			log.Fatalf("demo seed: %v", err)
		}
	}

	api.Version = version
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: api.NewRouter(db, cfg), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("ShiftYar %s listening on :%s", version, cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
