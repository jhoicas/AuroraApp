package services

import (
	"crypto/sha256"
	"encoding/binary"
	"math"
)

func deterministicEmbed(text string, dim int) []float32 {
	out := make([]float32, dim)
	if text == "" {
		return out
	}
	sum := sha256.Sum256([]byte(text))
	for i := 0; i < dim; i++ {
		b := sum[i%len(sum)]
		seed := binary.BigEndian.Uint32([]byte{b, sum[(i+1)%len(sum)], sum[(i+2)%len(sum)], sum[(i+3)%len(sum)]})
		out[i] = float32(math.Sin(float64(seed%10000)/1000.0) * 0.5)
	}
	return out
}
