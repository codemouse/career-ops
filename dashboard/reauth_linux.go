//go:build linux

package main

import (
	"fmt"
	"strings"
)

// linuxTerminalCandidates lists terminal emulators to try, in order, each
// paired with the flag it uses to run a shell command. Not exhaustive —
// covers the common desktop-environment default plus widely available
// fallbacks.
var linuxTerminalCandidates = []struct {
	name string
	flag string
}{
	{"x-terminal-emulator", "-e"},
	{"gnome-terminal", "--"},
	{"xterm", "-e"},
}

// openTerminalRunning launches command in dir inside a new, visible terminal
// window. Used for interactive scripts (e.g. plugins/gmail/reauth.mjs) that
// block on user browser interaction and must not be run headlessly inside a
// tea.Cmd goroutine.
func openTerminalRunning(dir string, command string) error {
	shellCmd := fmt.Sprintf("cd %s && %s; exec $SHELL", shellQuote(dir), command)

	var lastErr error
	for _, term := range linuxTerminalCandidates {
		args := []string{term.flag, "bash", "-c", shellCmd}
		if err := runReauthCommand(term.name, args...); err != nil {
			lastErr = err
			continue
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("no terminal emulator found")
	}
	return fmt.Errorf("could not launch a terminal window: %w", lastErr)
}

// shellQuote wraps s in single quotes for safe use as one shell argument.
func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
