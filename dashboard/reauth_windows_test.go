//go:build windows

package main

import (
	"strings"
	"testing"
)

func TestOpenTerminalRunningWindowsUsesStartCmd(t *testing.T) {
	previous := runReauthCommandWindows
	defer func() { runReauthCommandWindows = previous }()

	var gotName string
	var gotArgs []string
	runReauthCommandWindows = func(name string, args ...string) error {
		gotName = name
		gotArgs = append([]string(nil), args...)
		return nil
	}

	if err := openTerminalRunning(`C:\career-ops`, "node plugins/gmail/reauth.mjs"); err != nil {
		t.Fatalf("openTerminalRunning returned error: %v", err)
	}

	if gotName != "cmd" {
		t.Fatalf("command name = %q, want cmd", gotName)
	}
	if len(gotArgs) == 0 {
		t.Fatal("expected non-empty args")
	}
	joined := strings.Join(gotArgs, " ")
	if !strings.Contains(joined, "start") {
		t.Fatalf("args = %#v, want them to contain start", gotArgs)
	}
	if !strings.Contains(joined, `C:\career-ops`) {
		t.Fatalf("args = %#v, want them to cd into the target dir", gotArgs)
	}
	if !strings.Contains(joined, "node plugins/gmail/reauth.mjs") {
		t.Fatalf("args = %#v, want them to run the reauth command", gotArgs)
	}
}
