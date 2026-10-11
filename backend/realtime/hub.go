// Package realtimeは、単一APIプロセス内でGuestごとにイベントを配信する。
package realtime

import (
	"context"
	"errors"
	"sync"

	"github.com/google/uuid"
)

const QueueCapacity = 64

var (
	ErrHubStopped     = errors.New("realtime hub is stopped")
	ErrSlowConsumer   = errors.New("realtime connection queue is full")
	ErrInvalidGuestID = errors.New("realtime guest ID is nil")
)

type Hub struct {
	mu            sync.Mutex
	subscriptions map[uuid.UUID]map[*Subscription]struct{}
	connections   map[*Subscription]struct{}
	drained       chan struct{}
	stopped       bool
	forced        bool
}

func NewHub() *Hub {
	return &Hub{
		subscriptions: make(map[uuid.UUID]map[*Subscription]struct{}),
		connections:   make(map[*Subscription]struct{}), drained: make(chan struct{}),
	}
}

// Subscribeは、初期同期より先に接続を登録して更新をキューへ保持する。
// 呼び出し側は接続終了時にSubscription.Closeを呼ぶ。
func (h *Hub) Subscribe(guestID uuid.UUID) (*Subscription, error) {
	if guestID == uuid.Nil {
		return nil, ErrInvalidGuestID
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.stopped {
		return nil, ErrHubStopped
	}
	s := &Subscription{
		hub: h, guestID: guestID,
		messages: make(chan string, QueueCapacity), done: make(chan struct{}),
	}
	if h.subscriptions[guestID] == nil {
		h.subscriptions[guestID] = make(map[*Subscription]struct{})
	}
	h.subscriptions[guestID][s] = struct{}{}
	h.connections[s] = struct{}{}
	return s, nil
}

// Publishは、Guestの全接続へエンコード済みJSONを投入する。
// JSONはstringへコピーして以後不変とし、呼び出し側のバッファ変更から分離する。
// ネットワーク送信は待たず、キューが満杯の接続だけ解除する。
func (h *Hub) Publish(guestID uuid.UUID, message []byte) error {
	if guestID == uuid.Nil {
		return ErrInvalidGuestID
	}
	encoded := string(message)
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.stopped {
		return ErrHubStopped
	}
	for s := range h.subscriptions[guestID] {
		select {
		case s.messages <- encoded:
		default:
			h.removeLocked(s, ErrSlowConsumer)
		}
	}
	return nil
}

// Stopは、新規登録と配信を停止し、全接続へ終了を通知する。
// ネットワークCloseや接続ハンドラの終了待ちは呼び出し側が担当する。
func (h *Hub) Stop() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.stopped {
		return
	}
	h.stopped = true
	for _, subscriptions := range h.subscriptions {
		for s := range subscriptions {
			h.removeLocked(s, ErrHubStopped)
		}
	}
	if len(h.connections) == 0 {
		close(h.drained)
	}
}

// Shutdownは受付を止め、接続ハンドラの後片付けまで待つ。
// 共通期限に達した場合は、残っている接続のTCP通信を強制終了する。
func (h *Hub) Shutdown(ctx context.Context) error {
	h.Stop()
	select {
	case <-h.drained:
		return nil
	case <-ctx.Done():
		h.mu.Lock()
		h.forced = true
		var aborts []func()
		for s := range h.connections {
			if s.abort != nil {
				aborts = append(aborts, s.abort)
			}
		}
		h.mu.Unlock()
		for _, abort := range aborts {
			abort()
		}
		return ctx.Err()
	}
}

func (h *Hub) removeLocked(s *Subscription, err error) {
	if _, ok := h.subscriptions[s.guestID][s]; !ok {
		return
	}
	delete(h.subscriptions[s.guestID], s)
	if len(h.subscriptions[s.guestID]) == 0 {
		delete(h.subscriptions, s.guestID)
	}
	s.err = err
	close(s.done)
	// messagesは閉じない。終了はdoneで通知し、送信とのclose競合を避ける。
}

type Subscription struct {
	hub      *Hub
	guestID  uuid.UUID
	messages chan string
	done     chan struct{}
	err      error  // doneを閉じる前に設定し、その後は変更しない。
	abort    func() // hub.muで保護する。ネットワーク操作はロック外で行う。
}

// Messagesは登録後のイベントをFIFOで返す。Doneが閉じたら残りは破棄する。
func (s *Subscription) Messages() <-chan string { return s.messages }

func (s *Subscription) Done() <-chan struct{} { return s.done }

func (s *Subscription) Err() error {
	select {
	case <-s.done:
		return s.err
	default:
		return nil
	}
}

// Closeは登録を解除する。並行・重複呼び出しも安全。
func (s *Subscription) Close() {
	s.hub.mu.Lock()
	defer s.hub.mu.Unlock()
	s.hub.removeLocked(s, nil)
	if _, ok := s.hub.connections[s]; !ok {
		return
	}
	delete(s.hub.connections, s)
	if s.hub.stopped && len(s.hub.connections) == 0 {
		close(s.hub.drained)
	}
}

func (s *Subscription) setAbort(abort func()) {
	s.hub.mu.Lock()
	s.abort = abort
	forced := s.hub.forced
	s.hub.mu.Unlock()
	if forced {
		abort()
	}
}
