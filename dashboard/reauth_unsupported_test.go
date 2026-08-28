//go:build !windows && !darwin && !linux

package main

import "testing"

func TestOpenTerminalRunningReturnsErrorOnUnsupportedPlatform(t *testing.T) {
	if err := openTerminalRunning("/tmp", "echo hi"); err == nil {
		t.Fatal("expected an error on unsupported platform")
	}
}
