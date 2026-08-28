//go:build linux

package main

import (
	"fmt"
	"strings"
	"testing"
)

func TestOpenTerminalRunningLinuxTriesCandidates(t *testing.T) {
	previous := runReauthCommand
	defer func() { runReauthCommand = previous }()

	var calledNames []string
	runReauthCommand = func(name string, args ...string) error {
		calledNames = append(calledNames, name)
		// Only succeed for xterm to exercise the fallback path.
		if name == "xterm" {
			joined := strings.Join(args, " ")
			if !strings.Contains(joined, "/tmp/career-ops") {
				t.Fatalf("args = %#v, want them to cd into the target dir", args)
			}
			if !strings.Contains(joined, "node plugins/gmail/reauth.mjs") {
				t.Fatalf("args = %#v, want them to run the reauth command", args)
			}
			return nil
		}
		return fmt.Errorf("not found")
	}

	if err := openTerminalRunning("/tmp/career-ops", "node plugins/gmail/reauth.mjs"); err != nil {
		t.Fatalf("openTerminalRunning returned error: %v", err)
	}

	if len(calledNames) == 0 {
		t.Fatal("expected at least one terminal candidate to be tried")
	}
}

func TestOpenTerminalRunningLinuxReturnsErrorWhenNoneWork(t *testing.T) {
	previous := runReauthCommand
	defer func() { runReauthCommand = previous }()

	runReauthCommand = func(name string, args ...string) error {
		return fmt.Errorf("not found")
	}

	if err := openTerminalRunning("/tmp", "echo hi"); err == nil {
		t.Fatal("expected an error when no terminal emulator works")
	}
}
