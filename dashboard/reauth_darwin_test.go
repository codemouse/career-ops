//go:build darwin

package main

import (
	"strings"
	"testing"
)

func TestOpenTerminalRunningUsesOsascript(t *testing.T) {
	previous := runReauthCommand
	defer func() { runReauthCommand = previous }()

	var gotName string
	var gotArgs []string
	runReauthCommand = func(name string, args ...string) error {
		gotName = name
		gotArgs = append([]string(nil), args...)
		return nil
	}

	if err := openTerminalRunning("/tmp/career-ops", "node plugins/gmail/reauth.mjs"); err != nil {
		t.Fatalf("openTerminalRunning returned error: %v", err)
	}

	if gotName != "osascript" {
		t.Fatalf("command name = %q, want osascript", gotName)
	}
	if len(gotArgs) != 4 {
		t.Fatalf("command args = %#v, want 4 args (two -e pairs)", gotArgs)
	}
	if gotArgs[0] != "-e" || gotArgs[2] != "-e" {
		t.Fatalf("command args = %#v, want alternating -e flags", gotArgs)
	}
	if !strings.Contains(gotArgs[1], "activate") {
		t.Fatalf("first script = %q, want it to activate Terminal", gotArgs[1])
	}
	script := gotArgs[3]
	if !strings.Contains(script, "do script") {
		t.Fatalf("script = %q, want a `do script` command", script)
	}
	if !strings.Contains(script, "/tmp/career-ops") {
		t.Fatalf("script = %q, want it to cd into the target dir", script)
	}
	if !strings.Contains(script, "node plugins/gmail/reauth.mjs") {
		t.Fatalf("script = %q, want it to run the reauth command", script)
	}
}

func TestAppleScriptQuoteEscapesSpecialChars(t *testing.T) {
	got := appleScriptQuote(`say "hi" \ there`)
	want := `"say \"hi\" \\ there"`
	if got != want {
		t.Fatalf("appleScriptQuote() = %q, want %q", got, want)
	}
}

func TestShellQuoteEscapesSingleQuotes(t *testing.T) {
	got := shellQuote(`it's a test`)
	want := `'it'\''s a test'`
	if got != want {
		t.Fatalf("shellQuote() = %q, want %q", got, want)
	}
}
