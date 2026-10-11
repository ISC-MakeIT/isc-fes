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
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
)

const testReady = `{"type":"connection.ready","data":{"orders":[]}}`

type socketTestConfig struct {
	timing      connectionTiming
	expires     time.Time
	beforeRun   func(*Hub, uuid.UUID)
	loadReady   func(context.Context, *Hub, uuid.UUID) ([]byte, error)
	loadChanged func(context.Context, uuid.UUID) ([]byte, error)
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
		cfg.timing.pingInterval = time.Hour
	}
	if cfg.timing.initialSyncTimeout == 0 {
		cfg.timing.initialSyncTimeout = time.Second
	}
	if cfg.timing.updateSyncTimeout == 0 {
		cfg.timing.updateSyncTimeout = time.Second
	}
	if cfg.timing.pongTimeout == 0 {
		cfg.timing.pongTimeout = time.Second
	}
	if cfg.timing.writeTimeout == 0 {
		cfg.timing.writeTimeout = time.Second
	}
	if cfg.timing.closeTimeout == 0 {
		cfg.timing.closeTimeout = time.Second
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
		loadReady := func(ctx context.Context) ([]byte, error) {
			if cfg.loadReady != nil {
				return cfg.loadReady(ctx, f.hub, id)
			}
			return []byte(testReady), nil
		}
		loadChanged := cfg.loadChanged
		if loadChanged == nil {
			loadChanged = func(_ context.Context, orderID uuid.UUID) ([]byte, error) {
				return []byte(orderID.String()), nil
			}
		}
		f.finished <- conn.run(s, loadReady, loadChanged, cfg.expires, cfg.timing)
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
	event := uuid.New()
	f := newSocketFixture(t, socketTestConfig{loadReady: func(_ context.Context, h *Hub, id uuid.UUID) ([]byte, error) {
		if err := h.Publish(id, event); err != nil {
			t.Error(err)
		}
		return []byte(testReady), nil
	}})
	conn := f.dial(t, uuid.New(), nil)
	if first := readSocket(t, conn); first != testReady {
		t.Fatalf("first message = %s", first)
	}
	if second := readSocket(t, conn); second != event.String() {
		t.Fatalf("queued message = %s", second)
	}
	_ = conn.Close(websocket.StatusNormalClosure, "")
	if err := f.waitFinished(t); err != nil {
		t.Fatal(err)
	}
}

func TestConnectionLoadsQueuedChangesAfterInitialSnapshot(t *testing.T) {
	loading, release := make(chan struct{}), make(chan struct{})
	var completed atomic.Bool
	orderID := uuid.New()
	const ready = `{"type":"connection.ready","data":{"orders":[{"status":"ready"}]}}`
	const changed = `{"type":"orders.changed","data":{"orders":[]}}`
	f := newSocketFixture(t, socketTestConfig{
		loadReady: func(ctx context.Context, _ *Hub, _ uuid.UUID) ([]byte, error) {
			// 初期一覧を取得した後、送信前にDB状態が変わる状況。
			close(loading)
			select {
			case <-release:
				return []byte(ready), nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		},
		loadChanged: func(_ context.Context, got uuid.UUID) ([]byte, error) {
			if got != orderID || !completed.Load() {
				t.Errorf("change was loaded before completion: order=%s", got)
			}
			return []byte(changed), nil
		},
	})
	id := uuid.New()
	conn := f.dial(t, id, nil)
	select {
	case <-loading:
	case <-time.After(time.Second):
		t.Fatal("initial load did not start")
	}
	completed.Store(true)
	if err := f.hub.Publish(id, orderID); err != nil {
		t.Fatal(err)
	}
	close(release)
	if got := readSocket(t, conn); got != ready {
		t.Fatalf("ready = %s", got)
	}
	if got := readSocket(t, conn); got != changed {
		t.Fatalf("changed = %s", got)
	}
}

func TestConnectionChangedLoadsAreSerial(t *testing.T) {
	started, release := make(chan struct{}, 2), make(chan struct{})
	var calls, active atomic.Int32
	const old = `{"type":"orders.changed","data":{"orders":[{"status":"ready"}]}}`
	const latest = `{"type":"orders.changed","data":{"orders":[]}}`
	f := newSocketFixture(t, socketTestConfig{loadChanged: func(ctx context.Context, _ uuid.UUID) ([]byte, error) {
		if active.Add(1) != 1 {
			t.Error("snapshot loads overlapped")
		}
		defer active.Add(-1)
		call := calls.Add(1)
		started <- struct{}{}
		if call == 1 {
			select {
			case <-release:
				return []byte(old), nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		return []byte(latest), nil
	}})
	id := uuid.New()
	conn := f.dial(t, id, nil)
	_ = readSocket(t, conn)
	if err := f.hub.Publish(id, uuid.New()); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("changed load did not start")
	}
	if err := f.hub.Publish(id, uuid.New()); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
		t.Fatal("next snapshot loaded while previous snapshot was in progress")
	case <-time.After(50 * time.Millisecond):
	}
	close(release)
	if got := readSocket(t, conn); got != old {
		t.Fatalf("first changed = %s", got)
	}
	if got := readSocket(t, conn); got != latest {
		t.Fatalf("latest changed = %s", got)
	}
	if calls.Load() != 2 {
		t.Fatalf("load count = %d", calls.Load())
	}
}

func TestConnectionChangedSyncFailureAndDeadline(t *testing.T) {
	loadFailure := errors.New("order database unavailable")
	for _, scenario := range []struct {
		name       string
		wantError  error
		wantStatus websocket.StatusCode
	}{
		{"load failure", loadFailure, websocket.StatusInternalError},
		{"update sync timeout", context.DeadlineExceeded, websocket.StatusInternalError},
		{"session expiry during load", nil, websocket.StatusPolicyViolation},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			cfg := socketTestConfig{timing: connectionTiming{updateSyncTimeout: 80 * time.Millisecond}}
			if scenario.name == "session expiry during load" {
				cfg.expires = time.Now().Add(150 * time.Millisecond)
				cfg.timing.updateSyncTimeout = time.Second
			}
			cfg.loadChanged = func(ctx context.Context, _ uuid.UUID) ([]byte, error) {
				if scenario.wantError == loadFailure {
					return nil, loadFailure
				}
				<-ctx.Done()
				return nil, ctx.Err()
			}
			f := newSocketFixture(t, cfg)
			id := uuid.New()
			conn := f.dial(t, id, nil)
			_ = readSocket(t, conn)
			if err := f.hub.Publish(id, uuid.New()); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
			defer cancel()
			_, message, err := conn.Read(ctx)
			if websocket.CloseStatus(err) != scenario.wantStatus {
				t.Fatalf("changed message = %s, error = %v; want close %v", message, err, scenario.wantStatus)
			}
			if err := f.waitFinished(t); !errors.Is(err, scenario.wantError) {
				t.Fatalf("changed sync error = %v, want %v", err, scenario.wantError)
			}
		})
	}
}

func TestConnectionInitialSyncFailureAndDeadline(t *testing.T) {
	loadFailure := errors.New("order database unavailable")
	for _, scenario := range []struct {
		name       string
		wantError  error
		wantStatus websocket.StatusCode
	}{
		{"load failure", loadFailure, websocket.StatusInternalError},
		{"initial sync timeout", context.DeadlineExceeded, websocket.StatusInternalError},
		{"session expiry during load", nil, websocket.StatusPolicyViolation},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			cfg := socketTestConfig{timing: connectionTiming{initialSyncTimeout: 80 * time.Millisecond}}
			if scenario.name == "session expiry during load" {
				cfg.expires = time.Now().Add(80 * time.Millisecond)
				cfg.timing.initialSyncTimeout = time.Second
			}
			cfg.loadReady = func(ctx context.Context, _ *Hub, _ uuid.UUID) ([]byte, error) {
				if scenario.name == "load failure" {
					return nil, loadFailure
				}
				<-ctx.Done()
				return nil, ctx.Err()
			}
			f := newSocketFixture(t, cfg)
			conn := f.dial(t, uuid.New(), nil)
			ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
			defer cancel()
			_, message, err := conn.Read(ctx)
			if websocket.CloseStatus(err) != scenario.wantStatus {
				t.Fatalf("initial sync message = %s, error = %v; want close %v without ready", message, err, scenario.wantStatus)
			}
			if err := f.waitFinished(t); !errors.Is(err, scenario.wantError) {
				t.Fatalf("initial sync error = %v, want %v", err, scenario.wantError)
			}
		})
	}
}

func TestConnectionInitialLoadCanceledByStopOverflowResyncAndClient(t *testing.T) {
	for _, scenario := range []string{"stop", "overflow", "resync", "client data", "client disconnect"} {
		t.Run(scenario, func(t *testing.T) {
			loading, canceled := make(chan struct{}), make(chan struct{})
			f := newSocketFixture(t, socketTestConfig{
				timing: connectionTiming{initialSyncTimeout: 3 * time.Second},
				loadReady: func(ctx context.Context, _ *Hub, _ uuid.UUID) ([]byte, error) {
					close(loading)
					<-ctx.Done()
					close(canceled)
					return nil, ctx.Err()
				},
			})
			id := uuid.New()
			conn := f.dial(t, id, nil)
			ctx, cancel := context.WithTimeout(t.Context(), time.Second)
			defer cancel()
			select {
			case <-loading:
			case <-ctx.Done():
				t.Fatal("initial load did not start")
			}
			wantStatus := websocket.StatusGoingAway
			switch scenario {
			case "stop":
				f.hub.Stop()
			case "overflow":
				for range QueueCapacity + 1 {
					_ = f.hub.Publish(id, uuid.New())
				}
				wantStatus = websocket.StatusTryAgainLater
			case "resync":
				f.hub.ResyncGuest(id)
				wantStatus = websocket.StatusInternalError
			case "client data":
				if err := conn.Write(ctx, websocket.MessageText, []byte(`{}`)); err != nil {
					t.Fatal(err)
				}
				wantStatus = websocket.StatusPolicyViolation
			case "client disconnect":
				conn.CloseNow()
			}
			select {
			case <-canceled:
			case <-ctx.Done():
				t.Fatal("initial load was not canceled")
			}
			if scenario != "client disconnect" {
				_, _, err := conn.Read(ctx)
				if websocket.CloseStatus(err) != wantStatus {
					t.Fatalf("initial load cancellation close = %v, want %v", err, wantStatus)
				}
			}
			if err := f.waitFinished(t); err != nil {
				t.Fatal(err)
			}
		})
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
	orderID, otherOrderID := uuid.New(), uuid.New()
	_ = f.hub.Publish(guest, orderID)
	_ = f.hub.Publish(otherGuest, otherOrderID)
	for _, conn := range []*websocket.Conn{first, second} {
		if event := readSocket(t, conn); event != orderID.String() {
			t.Fatalf("Guest event = %s", event)
		}
	}
	if event := readSocket(t, other); event != otherOrderID.String() {
		t.Fatalf("other Guest event = %s", event)
	}
}

func TestConnectionOverflowDuringInitializationClosesWithoutReady(t *testing.T) {
	f := newSocketFixture(t, socketTestConfig{beforeRun: func(h *Hub, id uuid.UUID) {
		for range QueueCapacity + 1 {
			_ = h.Publish(id, uuid.New())
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
	f := newSocketFixture(t, socketTestConfig{timing: connectionTiming{pingInterval: 20 * time.Millisecond}})
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
	f := newSocketFixture(t, socketTestConfig{timing: connectionTiming{pingInterval: 20 * time.Millisecond, pongTimeout: 40 * time.Millisecond}})
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

func TestConnectionReadyWriteTimeoutAndInitialSyncBudget(t *testing.T) {
	for _, scenario := range []struct {
		name                 string
		initialTimeout       time.Duration
		writeTimeout         time.Duration
		consumeInitialBudget bool
	}{
		{"write timeout", time.Second, 40 * time.Millisecond, false},
		{"shared initial sync deadline", 200 * time.Millisecond, time.Second, true},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			hub := NewHub()
			finished := make(chan error, 1)
			initialDeadline := make(chan time.Time, 1)
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
				loadReady := func(ctx context.Context) ([]byte, error) {
					deadline, _ := ctx.Deadline()
					initialDeadline <- deadline
					if scenario.consumeInitialBudget {
						delay := time.NewTimer(time.Until(deadline) / 2)
						defer delay.Stop()
						select {
						case <-delay.C:
						case <-ctx.Done():
							return nil, ctx.Err()
						}
					}
					return []byte(testReady), nil
				}
				finished <- conn.run(s, loadReady, nil, time.Now().Add(time.Hour), connectionTiming{
					initialSyncTimeout: scenario.initialTimeout, pingInterval: time.Hour, pongTimeout: time.Second,
					writeTimeout: scenario.writeTimeout, closeTimeout: time.Second,
				})
			}))
			defer server.Close()
			ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
			defer cancel()
			conn, _, err := websocket.Dial(ctx, strings.Replace(server.URL, "http", "ws", 1), nil)
			if err != nil {
				t.Fatal(err)
			}
			defer conn.CloseNow()
			var deadline time.Time
			select {
			case deadline = <-initialDeadline:
			case <-ctx.Done():
				t.Fatal("initial load did not start")
			}
			// 取得後に送信期限をリセットすると、この共通期限を超えて失敗する。
			limit := time.NewTimer(time.Until(deadline) + 200*time.Millisecond)
			defer limit.Stop()
			select {
			case err := <-finished:
				if !errors.Is(err, context.DeadlineExceeded) {
					t.Fatalf("ready timeout = %v", err)
				}
			case <-limit.C:
				t.Fatal("ready write exceeded the shared initial sync deadline")
			}
			if err := hub.Shutdown(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}
func TestConnectionChangedLoadCanceledByStopOverflowResyncAndClient(t *testing.T) {
	for _, scenario := range []string{"stop", "overflow", "resync", "client data", "client disconnect"} {
		t.Run(scenario, func(t *testing.T) {
			loading, canceled := make(chan struct{}), make(chan struct{})
			f := newSocketFixture(t, socketTestConfig{
				timing: connectionTiming{updateSyncTimeout: 3 * time.Second},
				loadChanged: func(ctx context.Context, _ uuid.UUID) ([]byte, error) {
					close(loading)
					<-ctx.Done()
					close(canceled)
					return nil, ctx.Err()
				},
			})
			id := uuid.New()
			conn := f.dial(t, id, nil)
			_ = readSocket(t, conn)
			if err := f.hub.Publish(id, uuid.New()); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(t.Context(), time.Second)
			defer cancel()
			select {
			case <-loading:
			case <-ctx.Done():
				t.Fatal("changed load did not start")
			}
			wantStatus := websocket.StatusGoingAway
			switch scenario {
			case "stop":
				f.hub.Stop()
			case "overflow":
				for range QueueCapacity + 1 {
					_ = f.hub.Publish(id, uuid.New())
				}
				wantStatus = websocket.StatusTryAgainLater
			case "resync":
				f.hub.ResyncGuest(id)
				wantStatus = websocket.StatusInternalError
			case "client data":
				if err := conn.Write(ctx, websocket.MessageText, []byte(`{}`)); err != nil {
					t.Fatal(err)
				}
				wantStatus = websocket.StatusPolicyViolation
			case "client disconnect":
				conn.CloseNow()
			}
			select {
			case <-canceled:
			case <-ctx.Done():
				t.Fatal("changed load was not canceled")
			}
			if scenario != "client disconnect" {
				_, _, err := conn.Read(ctx)
				if websocket.CloseStatus(err) != wantStatus {
					t.Fatalf("changed load cancellation close = %v, want %v", err, wantStatus)
				}
			}
			if err := f.waitFinished(t); err != nil {
				t.Fatal(err)
			}
		})
	}
}
