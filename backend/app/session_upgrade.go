package app

import (
	"bufio"
	"fmt"
	"net"
	"net/http"

	"golang.org/x/net/http/httpguts"
)

// scsは101応答の直前にセッションを保存する。保存エラーの500応答後に
// coder.AcceptがHijackを続けないよう、セッションミドルウェアの外側で保護する。
func guardSessionUpgrade(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !httpguts.HeaderValuesContainsToken(r.Header.Values("Upgrade"), "websocket") {
			next.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(&sessionUpgradeWriter{ResponseWriter: w}, r)
	})
}

type sessionUpgradeWriter struct {
	http.ResponseWriter
	status int
}

func (w *sessionUpgradeWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (w *sessionUpgradeWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	if status >= 200 || status == http.StatusSwitchingProtocols {
		w.status = status
		if status != http.StatusSwitchingProtocols {
			w.Header().Del("Upgrade")
			w.Header().Del("Connection")
			w.Header().Del("Sec-WebSocket-Accept")
		}
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *sessionUpgradeWriter) Write(body []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}

func (w *sessionUpgradeWriter) Flush() {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	_ = http.NewResponseController(w.ResponseWriter).Flush()
}

func (w *sessionUpgradeWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if w.status != http.StatusSwitchingProtocols {
		return nil, nil, fmt.Errorf("refuse WebSocket upgrade after HTTP status %d", w.status)
	}
	return http.NewResponseController(w.ResponseWriter).Hijack()
}
