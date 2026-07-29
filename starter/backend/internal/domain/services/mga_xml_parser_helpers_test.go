package services

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanText(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in, want string
	}{
		{"", ""},
		{"  hola  ", "hola"},
		{"a\n\tb   c", "a b c"},
		{"ya limpio", "ya limpio"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, cleanText(tt.in))
	}
}

func TestSlugProjectKey(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in, want string
	}{
		{"", "proyecto-mga"},
		{"   ", "proyecto-mga"},
		{"Acueducto Rural.xml", "acueducto-rural"},
		{"Proyecto!!! 2024", "proyecto-2024"},
		{strings.Repeat("a", 200), strings.Repeat("a", 120)},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, slugProjectKey(tt.in))
	}
}

func TestLocalName(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "Cause", localName("Cause"))
	assert.Equal(t, "Cause", localName("mga:Cause"))
}

func TestHasLinkTo(t *testing.T) {
	t.Parallel()
	links := []ParsedLink{{SourceLocalID: "a", TargetLocalID: "b", Relationship: "r"}}
	assert.True(t, hasLinkTo(links, "a", "b"))
	assert.False(t, hasLinkTo(links, "b", "a"))
	assert.False(t, hasLinkTo(nil, "a", "b"))
}

func TestGraphBuilder_LinkGuards(t *testing.T) {
	t.Parallel()
	b := &graphBuilder{}
	b.link("", "x", "r")
	b.link("x", "", "r")
	b.link("x", "x", "r")
	assert.Empty(t, b.links)
	b.link("a", "b", "has_cause")
	assert.Len(t, b.links, 1)
}

func TestParseMGA_FailingReader(t *testing.T) {
	t.Parallel()
	_, _, err := ParseMGAProjectXML(&errReader{}, "x.xml")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "read xml")
}

type errReader struct{}

func (errReader) Read([]byte) (int, error) {
	return 0, assert.AnError
}
