// Package cache provides an in-memory TTL cache for analysis results.
package cache

import (
	"sync"
	"time"
)

// Entry represents a cached item with an expiration time.
type Entry struct {
	Value     interface{}
	ExpiresAt time.Time
}

// Cache is a thread-safe in-memory cache with TTL support.
type Cache struct {
	mu      sync.RWMutex
	items   map[string]Entry
	ttl     time.Duration
	maxSize int
}

// New creates a new Cache with the given TTL and maximum size.
// TTL defaults to 15 minutes if zero, maxSize defaults to 100 if zero.
func New(ttl time.Duration, maxSize int) *Cache {
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	if maxSize <= 0 {
		maxSize = 100
	}
	c := &Cache{
		items:   make(map[string]Entry),
		ttl:     ttl,
		maxSize: maxSize,
	}
	go c.cleanupLoop()
	return c
}

// Get retrieves a value from the cache. Returns nil, false if not found or expired.
func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, ok := c.items[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.ExpiresAt) {
		return nil, false
	}
	return entry.Value, true
}

// Set stores a value in the cache with the default TTL.
func (c *Cache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Evict oldest entry if at capacity
	if len(c.items) >= c.maxSize {
		var oldestKey string
		var oldestTime time.Time
		first := true
		for k, v := range c.items {
			if first || v.ExpiresAt.Before(oldestTime) {
				oldestKey = k
				oldestTime = v.ExpiresAt
				first = false
			}
		}
		delete(c.items, oldestKey)
	}

	c.items[key] = Entry{
		Value:     value,
		ExpiresAt: time.Now().Add(c.ttl),
	}
}

// Delete removes a key from the cache.
func (c *Cache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}

// Clear removes all entries from the cache.
func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = make(map[string]Entry)
}

// Size returns the number of items currently in the cache.
func (c *Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}

// cleanupLoop periodically removes expired entries.
func (c *Cache) cleanupLoop() {
	ticker := time.NewTicker(c.ttl / 2)
	defer ticker.Stop()
	for range ticker.C {
		c.cleanup()
	}
}

// cleanup removes all expired entries.
func (c *Cache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for key, entry := range c.items {
		if now.After(entry.ExpiresAt) {
			delete(c.items, key)
		}
	}
}
