package realtime

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/coder/websocket"
)

const (
	InitialSyncTimeout = 10 * time.Second
	PingInterval       = 30 * time.Second
	PongTimeout        = 10 * time.Second
	WriteTimeout       = 10 * time.Second
	CloseTimeout       = 10 * time.Second
)

type Connection struct {
	socket    *websocket.Conn
	transport net.Conn
}

// Acceptは検証済みのOriginを持つHTTPリクエストをWSへ切り替える。
// HijackしたTCP接続も保持し、停止期限を超えた場合に確実に閉じられるようにする。
func Accept(w http.ResponseWriter, r *http.Request) (*Connection, error) {
	writer := &upgradeWriter{ResponseWriter: w}
	socket, err := websocket.Accept(writer, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return nil, err
	}
	return &Connection{socket: socket, transport: writer.transport}, nil
}

// CloseNowはHTTPハンドラがHubへ登録できなかった場合にも通信を解放する。
func (c *Connection) CloseNow() {
	_ = c.transport.Close()
	_ = c.socket.CloseNow()
}

type connectionTiming struct {
	initialSyncTimeout time.Duration
	pingInterval       time.Duration
	pongTimeout        time.Duration
	writeTimeout       time.Duration
	closeTimeout       time.Duration
}

// RunはloadReadyで初期同期し、readyを先頭に送ってからキューのJSONを配信する。
// loadReadyはcontextの期限・キャンセルに従い、取得と送信に共通の期限を適用する。
// expiresは接続時に確定した期限。HTTPリクエストのcontextや期限更新には追従しない。
// 終了時は通信・受信goroutineを終了してからSubscriptionを解除する。
func (c *Connection) Run(s *Subscription, loadReady func(context.Context) ([]byte, error), expires time.Time) error {
	return c.run(s, loadReady, expires, connectionTiming{
		initialSyncTimeout: InitialSyncTimeout,
		pingInterval:       PingInterval, pongTimeout: PongTimeout,
		writeTimeout: WriteTimeout, closeTimeout: CloseTimeout,
	})
}

func (c *Connection) run(s *Subscription, loadReady func(context.Context) ([]byte, error), expires time.Time, timing connectionTiming) error {
	s.setAbort(func() { _ = c.transport.Close() })
	initialCtx, cancelInitial := operationContext(expires, timing.initialSyncTimeout)
	defer cancelInitial()
	loadCtx, cancelLoad := context.WithCancel(initialCtx)
	defer cancelLoad()
	readCtx, cancelRead := context.WithCancel(context.Background())
	readResult := make(chan error, 1)
	readerDone := make(chan struct{})
	go func() {
		defer close(readerDone)
		_, _, err := c.socket.Reader(readCtx)
		readResult <- err // nilはクライアントのアプリケーションデータを意味する。
		cancelLoad()      // 初期一覧の取得中でも、クライアント切断でDB処理を中断する。
	}()

	finished := make(chan struct{})
	closerDone := make(chan struct{})
	go func() {
		defer close(closerDone)
		select {
		case <-s.Done():
			// DB取得だけ中断する。WS書き込みをキャンセルしてCloseの機会を失わない。
			cancelLoad()
			code, reason := websocket.StatusNormalClosure, "connection closed"
			if errors.Is(s.Err(), ErrHubStopped) {
				code, reason = websocket.StatusGoingAway, "server stopping"
			} else if errors.Is(s.Err(), ErrSlowConsumer) {
				code, reason = websocket.StatusTryAgainLater, "connection queue full; reconnect"
			} else if errors.Is(s.Err(), ErrResyncRequired) {
				code, reason = websocket.StatusInternalError, "order resync required; reconnect"
			}
			c.close(code, reason, timing.closeTimeout)
		case <-finished:
		}
	}()
	defer func() {
		close(finished)
		// TCPを先に閉じ、Closeの応答待ちや受信処理も確実に解放する。
		c.CloseNow()
		cancelRead()
		<-readerDone
		<-closerDone
		s.Close()
	}()

	if !time.Now().Before(expires) {
		c.close(websocket.StatusPolicyViolation, "guest session expired", timing.closeTimeout)
		return nil
	}
	select {
	case <-s.Done():
		<-closerDone
		return nil
	default:
	}
	ready, err := loadReady(loadCtx)
	if err == nil {
		err = loadCtx.Err()
	}
	if err == nil {
		writeCtx, cancelWrite := context.WithTimeout(initialCtx, timing.writeTimeout)
		err = c.socket.Write(writeCtx, websocket.MessageText, ready)
		cancelWrite()
	}
	cancelLoad()
	cancelInitial()
	if err != nil {
		select {
		case <-s.Done():
			<-closerDone
			return nil
		default:
		}
		if !time.Now().Before(expires) {
			c.close(websocket.StatusPolicyViolation, "guest session expired", timing.closeTimeout)
			return nil
		}
		if !errors.Is(err, context.DeadlineExceeded) {
			select {
			case readErr := <-readResult:
				return c.handleReadResult(s, expires, readErr, timing.closeTimeout)
			default:
			}
		}
		c.close(websocket.StatusInternalError, "initial sync failed", timing.closeTimeout)
		return fmt.Errorf("initialize WebSocket: %w", err)
	}

	ping := time.NewTicker(timing.pingInterval)
	defer ping.Stop()
	expiry := time.NewTimer(time.Until(expires))
	defer expiry.Stop()
	for {
		// 終了後は残っているキューを排出しない。
		select {
		case <-s.Done():
			<-closerDone
			return nil
		default:
		}
		select {
		case <-s.Done():
			<-closerDone
			return nil
		case err := <-readResult:
			return c.handleReadResult(s, expires, err, timing.closeTimeout)
		case <-expiry.C:
			c.close(websocket.StatusPolicyViolation, "guest session expired", timing.closeTimeout)
			return nil
		case <-ping.C:
			ctx, cancel := operationContext(expires, timing.pongTimeout)
			err := c.socket.Ping(ctx)
			cancel()
			if err != nil {
				return connectionFailure(s, expires, fmt.Errorf("ping WebSocket: %w", err))
			}
		case message := <-s.Messages():
			if err := c.write([]byte(message), expires, timing.writeTimeout); err != nil {
				return connectionFailure(s, expires, fmt.Errorf("write WebSocket event: %w", err))
			}
		}
	}
}

func (c *Connection) handleReadResult(s *Subscription, expires time.Time, err error, closeTimeout time.Duration) error {
	if err == nil {
		c.close(websocket.StatusPolicyViolation, "unexpected data message", closeTimeout)
		return nil
	}
	if websocket.CloseStatus(err) == websocket.StatusNormalClosure || websocket.CloseStatus(err) == websocket.StatusGoingAway ||
		errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed) {
		return nil
	}
	return connectionFailure(s, expires, fmt.Errorf("read WebSocket: %w", err))
}

// 停止やセッション期限による意図した切断を、サーバー障害として記録しない。
func connectionFailure(s *Subscription, expires time.Time, err error) error {
	select {
	case <-s.Done():
		return nil
	default:
	}
	if !time.Now().Before(expires) {
		return nil
	}
	return err
}

func operationContext(expires time.Time, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithDeadline(context.Background(), minTime(expires, time.Now().Add(timeout)))
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func (c *Connection) write(message []byte, expires time.Time, timeout time.Duration) error {
	ctx, cancel := operationContext(expires, timeout)
	defer cancel()
	return c.socket.Write(ctx, websocket.MessageText, message)
}

func (c *Connection) close(code websocket.StatusCode, reason string, timeout time.Duration) {
	// coderのClose応答待ちが停滞しても、この期限でTCPを切断する。
	force := time.AfterFunc(timeout, func() { _ = c.transport.Close() })
	defer force.Stop()
	_ = c.socket.Close(code, reason)
}

type upgradeWriter struct {
	http.ResponseWriter
	transport net.Conn
}

func (w *upgradeWriter) WriteHeaderNow() {
	if ginWriter, ok := w.ResponseWriter.(interface{ WriteHeaderNow() }); ok {
		ginWriter.WriteHeaderNow()
	}
}

func (w *upgradeWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	conn, buffered, err := http.NewResponseController(w.ResponseWriter).Hijack()
	if err == nil {
		w.transport = conn
	}
	return conn, buffered, err
}
