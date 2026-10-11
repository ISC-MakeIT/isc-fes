package realtime

import (
	"bufio"
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
)

const testReady = `{"type":"connection.ready","data":{"orders":[]}}`

type socketTestConfig struct {
	timing    connectionTiming
	expires   time.Time
	beforeRun func(*Hub, uuid.UUID)
}

type socketFixture struct {
	hub      *Hub
	server   *httptest.Server
	finished chan error
}

func newSocketFixture(t *testing.T, cfg socketTestConfig) *socketFixture {
	t.Helper()
	if cfg.expires.IsZero() {
		cfg.expires = time.Now().Add(time.Hour)
	}
	if cfg.timing.pingInterval == 0 {
		cfg.timing = connectionTiming{time.Hour, time.Second, time.Second, time.Second}
	}
	f := &socketFixture{hub: NewHub(), finished: make(chan error, 16)}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(strings.TrimPrefix(r.URL.Path, "/"))
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		conn, err := Accept(w, r)
		if err != nil {
			f.finished <- err
			return
		}
		defer conn.CloseNow()
		s, err := f.hub.Subscribe(id)
		if err != nil {
			f.finished <- err
			return
		}
		if cfg.beforeRun != nil {
			cfg.beforeRun(f.hub, id)
		}
		f.finished <- conn.run(s, []byte(testReady), cfg.expires, cfg.timing)
	}))
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := f.hub.Shutdown(ctx); err != nil {
			t.Error(err)
		}
		f.server.Close()
	})
	return f
}

func (f *socketFixture) dial(t *testing.T, id uuid.UUID, opts *websocket.DialOptions) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, strings.Replace(f.server.URL, "http", "ws", 1)+"/"+id.String(), opts)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return conn
}

func readSocket(t *testing.T, conn *websocket.Conn) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	typ, message, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if typ != websocket.MessageText {
		t.Fatalf("message type = %v", typ)
	}
	return string(message)
}

func (f *socketFixture) waitFinished(t *testing.T) error {
	t.Helper()
	select {
	case err := <-f.finished:
		return err
	case <-time.After(3 * time.Second):
		t.Fatal("WebSocket connection did not finish")
		return nil
	}
}

func TestConnectionReadyPrecedesQueuedEvents(t *testing.T) {
	const event = `{"type":"test.changed","data":{"version":1}}`
	f := newSocketFixture(t, socketTestConfig{beforeRun: func(h *Hub, id uuid.UUID) {
		if err := h.Publish(id, []byte(event)); err != nil {
			t.Error(err)
		}
	}})
	conn := f.dial(t, uuid.New(), nil)
	if first := readSocket(t, conn); first != testReady {
		t.Fatalf("first message = %s", first)
	}
	if second := readSocket(t, conn); second != event {
		t.Fatalf("queued message = %s", second)
	}
	_ = conn.Close(websocket.StatusNormalClosure, "")
	if err := f.waitFinished(t); err != nil {
		t.Fatal(err)
	}
}

func TestConnectionFanoutAndGuestIsolation(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{})
	guest, otherGuest := uuid.New(), uuid.New()
	first, second, other := f.dial(t, guest, nil), f.dial(t, guest, nil), f.dial(t, otherGuest, nil)
	for _, conn := range []*websocket.Conn{first, second, other} {
		if ready := readSocket(t, conn); ready != testReady {
			t.Fatalf("ready = %s", ready)
		}
	}
	_ = f.hub.Publish(guest, []byte(`{"guest":"first"}`))
	_ = f.hub.Publish(otherGuest, []byte(`{"guest":"other"}`))
	for _, conn := range []*websocket.Conn{first, second} {
		if event := readSocket(t, conn); event != `{"guest":"first"}` {
			t.Fatalf("Guest event = %s", event)
		}
	}
	if event := readSocket(t, other); event != `{"guest":"other"}` {
		t.Fatalf("other Guest event = %s", event)
	}
}

func TestConnectionOverflowDuringInitializationClosesWithoutReady(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{beforeRun: func(h *Hub, id uuid.UUID) {
		for range QueueCapacity + 1 {
			_ = h.Publish(id, []byte(`{}`))
		}
	}})
	conn := f.dial(t, uuid.New(), nil)
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusTryAgainLater {
		t.Fatalf("queue overflow close = %v, want 1013", err)
	}
	if err := f.waitFinished(t); err != nil {
		t.Fatal(err)
	}
}

func TestConnectionPeriodicPingReceivesPong(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{timing: connectionTiming{20 * time.Millisecond, time.Second, time.Second, time.Second}})
	pings := make(chan struct{}, 8)
	conn := f.dial(t, uuid.New(), &websocket.DialOptions{OnPingReceived: func(context.Context, []byte) bool {
		pings <- struct{}{}
		return true
	}})
	_ = readSocket(t, conn)
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	conn.CloseRead(ctx)
	for range 2 {
		select {
		case <-pings:
		case <-ctx.Done():
			t.Fatal("server did not send periodic Ping")
		}
	}
	_ = conn.Close(websocket.StatusNormalClosure, "")
	if err := f.waitFinished(t); err != nil {
		t.Fatal(err)
	}
}

func TestConnectionPongTimeoutUnregisters(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{timing: connectionTiming{20 * time.Millisecond, 40 * time.Millisecond, time.Second, time.Second}})
	conn := f.dial(t, uuid.New(), nil)
	_ = readSocket(t, conn)
	// 以降は読まない。Goクライアントは受信処理がないとPongを返さない。
	if err := f.waitFinished(t); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Pong timeout error = %v", err)
	}
	if len(f.hub.connections) != 0 {
		t.Fatal("Pong timeout retained connection in Hub")
	}
}

func TestConnectionExpiresAtEstablishedSessionDeadline(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{expires: time.Now().Add(150 * time.Millisecond)})
	conn := f.dial(t, uuid.New(), nil)
	_ = readSocket(t, conn)
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	_, _, err := conn.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
		t.Fatalf("session expiry close = %v, want 1008", err)
	}
	if err := f.waitFinished(t); err != nil {
		t.Fatal(err)
	}
}

func TestHubShutdownClosesConnectionsInParallel(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{})
	statuses := make(chan websocket.StatusCode, 3)
	for range 3 {
		conn := f.dial(t, uuid.New(), nil)
		_ = readSocket(t, conn)
		go func() {
			_, _, err := conn.Read(t.Context())
			statuses <- websocket.CloseStatus(err)
		}()
	}
	ctx, cancel := context.WithTimeout(t.Context(), time.Second)
	defer cancel()
	if err := f.hub.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	for range 3 {
		if status := <-statuses; status != websocket.StatusGoingAway {
			t.Fatalf("server shutdown close = %v, want 1001", status)
		}
		if err := f.waitFinished(t); err != nil {
			t.Fatal(err)
		}
	}
}

func TestHubShutdownDeadlineForcesUnresponsiveConnection(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{})
	conn := f.dial(t, uuid.New(), nil)
	_ = readSocket(t, conn)
	// Closeを読まないクライアントでも、共通期限で強制切断できる。
	ctx, cancel := context.WithTimeout(t.Context(), 40*time.Millisecond)
	defer cancel()
	if err := f.hub.Shutdown(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("shutdown deadline error = %v", err)
	}
	_ = f.waitFinished(t)
}

// 101応答の後にTCP送信を止め、ネットワーク速度に依存せず書き込み期限を検証する。
type blockedUpgradeWriter struct{ http.ResponseWriter }

func (w blockedUpgradeWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	conn, buffered, err := http.NewResponseController(w.ResponseWriter).Hijack()
	if err != nil {
		return nil, nil, err
	}
	if err := buffered.Writer.Flush(); err != nil {
		conn.Close()
		return nil, nil, err
	}
	blocked := &blockedConnection{Conn: conn, closed: make(chan struct{})}
	buffered.Writer.Reset(blocked)
	return blocked, buffered, nil
}

type blockedConnection struct {
	net.Conn
	closed chan struct{}
	once   sync.Once
}

func (c *blockedConnection) Write([]byte) (int, error) {
	<-c.closed
	return 0, net.ErrClosed
}

func (c *blockedConnection) Close() error {
	c.once.Do(func() { close(c.closed) })
	return c.Conn.Close()
}

func TestConnectionWriteTimeoutReleasesConnection(t *testing.T) {
	hub := NewHub()
	finished := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := Accept(blockedUpgradeWriter{ResponseWriter: w}, r)
		if err != nil {
			finished <- err
			return
		}
		defer conn.CloseNow()
		s, err := hub.Subscribe(uuid.New())
		if err != nil {
			finished <- err
			return
		}
		finished <- conn.run(s, []byte(testReady), time.Now().Add(time.Hour), connectionTiming{time.Hour, time.Second, 40 * time.Millisecond, time.Second})
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, strings.Replace(server.URL, "http", "ws", 1), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()
	select {
	case err := <-finished:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("write timeout = %v", err)
		}
	case <-ctx.Done():
		t.Fatal("write timeout did not release connection")
	}
	if err := hub.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
}
