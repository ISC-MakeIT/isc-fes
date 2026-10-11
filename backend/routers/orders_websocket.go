package routers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/realtime"
	"github.com/isc-makeit/isc-fes/backend/utils"
	"golang.org/x/net/http/httpguts"
)

type guestSessionDeadline interface {
	Deadline(context.Context) time.Time
}

type connectionReady struct {
	Type string              `json:"type"`
	Data connectionReadyData `json:"data"`
}

type connectionReadyData struct {
	Orders []Order `json:"orders"` // GET /orders などと同じ Order 構造体を使用する
}

func (s *Server) ordersWebSocket(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !allowedWebSocketOrigin(c.Request.Header.Values("Origin"), allowedOrigins) {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		if status := webSocketHandshakeStatus(c.Request); status != 0 {
			if status == http.StatusUpgradeRequired {
				c.Header("Connection", "Upgrade")
				c.Header("Upgrade", "websocket")
			}
			c.Header("Sec-WebSocket-Version", "13")
			c.AbortWithStatus(status)
			return
		}

		guestID, err := s.guestResolver.ResolveOrCreateGuest(c.Request.Context())
		if err != nil {
			captureUnexpectedError(c, fmt.Errorf("resolve WebSocket guest: %w", err))
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		expires := s.guestSession.Deadline(c.Request.Context())

		// Originは上でスキーム・ホスト・ポートを含む完全一致で検証済み。
		// coderの同一Host自動許可やパターンマッチは使用しない。
		conn, err := realtime.Accept(c.Writer, c.Request)
		if err != nil {
			captureUnexpectedError(c, err)
			return
		}
		defer conn.CloseNow()
		subscription, err := s.ordersHub.Subscribe(guestID)
		if err != nil {
			return // 停止中は登録せず、deferで通信を解放する。
		}
		defer subscription.Close()
		loadReady := func(ctx context.Context) ([]byte, error) {
			orders, err := s.orders.GetOrdersForGuest(ctx, guestID)
			if err != nil {
				return nil, fmt.Errorf("get initial WebSocket orders: %w", err)
			}
			return json.Marshal(connectionReady{
				Type: "connection.ready",
				Data: connectionReadyData{Orders: utils.Map(orders, toOrderResponse)},
			})
		}
		if err := conn.Run(subscription, loadReady, expires); err != nil {
			captureUnexpectedError(c, err)
		}
	}
}

func allowedWebSocketOrigin(origins, allowedOrigins []string) bool {
	if len(origins) != 1 {
		return false
	}
	value := origins[0]
	origin, err := url.Parse(value)
	if err != nil || (origin.Scheme != "http" && origin.Scheme != "https") ||
		origin.Hostname() == "" || origin.User != nil || origin.Opaque != "" ||
		origin.Path != "" || origin.RawQuery != "" || origin.ForceQuery ||
		origin.Fragment != "" || value != origin.Scheme+"://"+origin.Host {
		return false
	}
	return slices.Contains(allowedOrigins, value)
}

// Guest発行前にRFC 6455のハンドシェイク項目を検証する。
// coder.Acceptでも検証するが、その時点ではGuest発行済みとなるため先に行う。
func webSocketHandshakeStatus(r *http.Request) int {
	if !r.ProtoAtLeast(1, 1) ||
		!httpguts.HeaderValuesContainsToken(r.Header.Values("Connection"), "Upgrade") ||
		!httpguts.HeaderValuesContainsToken(r.Header.Values("Upgrade"), "websocket") {
		return http.StatusUpgradeRequired
	}
	if r.Method != http.MethodGet {
		return http.StatusMethodNotAllowed
	}
	if r.Header.Get("Sec-WebSocket-Version") != "13" {
		return http.StatusBadRequest
	}
	keys := r.Header.Values("Sec-WebSocket-Key")
	if len(keys) != 1 {
		return http.StatusBadRequest
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(keys[0]))
	if err != nil || len(key) != 16 {
		return http.StatusBadRequest
	}
	return 0
}
