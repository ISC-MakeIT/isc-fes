// Discord に Webhook 経由で送信することで、想定外のエラーなどを開発者に通知するためのサービス

package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/isc-makeit/isc-fes/backend/internal/utils"
)

type ErrorNotifier struct {
	MentionUserIDs []string
	WebhookURL     string
	client         http.Client
}

func NewErrorNotifier(webhookURL string, mentionUserIDs []string) *ErrorNotifier {
	return &ErrorNotifier{
		WebhookURL:     webhookURL,
		MentionUserIDs: mentionUserIDs,
		client: http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// Discord に送信する Payload
type discordWebhookPayload struct {
	Content         string `json:"content"`
	AllowedMentions struct {
		Users []string `json:"users"`
	}
	Embeds []embed `json:"embeds"`
}

type embed struct {
	Title       string       `json:"title,omitempty"`
	Description string       `json:"description,omitempty"`
	Color       int          `json:"color,omitempty"`
	Fields      []embedField `json:"fields,omitempty"`
	Footer      *embedFooter `json:"footer,omitempty"`
	Timestamp   string       `json:"timestamp,omitempty"`
}

type embedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline,omitempty"`
}

type embedFooter struct {
	Text string `json:"text"`
}

func (n *ErrorNotifier) Critical(ctx context.Context, message string) error {
	if n.WebhookURL == "" { // Webhook URL が設定されていない場合は送信しない
		return nil
	}

	formattedIds := utils.Map(n.MentionUserIDs, func(id string) string {
		return "<@" + id + ">"
	})
	payload := discordWebhookPayload{
		Content: strings.Join(formattedIds, " "),
		AllowedMentions: struct {
			Users []string `json:"users"`
		}{
			Users: n.MentionUserIDs,
		},
		Embeds: []embed{{
			Title:       "予期せぬエラーが発生しました",
			Description: message,
			Color:       0xFF0000, // 赤色
		},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := n.client.Do(req)

	if err != nil {
		return fmt.Errorf("send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return fmt.Errorf("webhook returned %s: %s", resp.Status, responseBody)
	}

	return nil
}
