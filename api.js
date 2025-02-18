const express = require('express');
const { SatoruScraper } = require('./scraper');
const router = express.Router();

// Initialize the scraper
const scraper = new SatoruScraper();

// Default cache configuration
const DEFAULT_CACHE_CONFIG = {
    duration: 3600, // 1 hour in seconds
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        error: err.message
    });
};

// Search anime
router.get('/search', async (req, res, next) => {
    try {
        const { query, page = 1 } = req.query;
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        const results = await scraper.search(query, page, {
            key: `search:${query}:${page}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json(results);
    } catch (error) {
        next(error);
    }
});

// Get anime info
router.get('/info/:animeId', async (req, res, next) => {
    try {
        const { animeId } = req.params;
        const info = await scraper.getAnimeInfo(animeId, {
            key: `info:${animeId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        next(error);
    }
});

// Get episodes list
router.get('/episodes/:animeId', async (req, res, next) => {
    try {
        const { animeId } = req.params;
        const episodes = await scraper.getEpisodes(animeId, {
            key: `episodes:${animeId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: episodes
        });
    } catch (error) {
        next(error);
    }
});

// Get episode servers
router.get('/servers/:episodeId', async (req, res, next) => {
    try {
        const { episodeId } = req.params;
        const servers = await scraper.getEpisodeServers(episodeId, {
            key: `servers:${episodeId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: servers
        });
    } catch (error) {
        next(error);
    }
});

// Get video sources
router.get('/sources/:animeId/:episodeId', async (req, res, next) => {
    try {
        const { animeId, episodeId } = req.params;
        const sources = await scraper.getVideoSources(animeId, episodeId, {
            key: `sources:${animeId}:${episodeId}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: sources
        });
    } catch (error) {
        next(error);
    }
});

// Get Satoru Anime ID by title
router.get('/id/:title', async (req, res, next) => {
    try {
        const { title } = req.params;
        const id = await scraper.getSatoruAnimeId(title, {
            key: `id:${title}`,
            ...DEFAULT_CACHE_CONFIG
        });
        res.json({
            success: true,
            data: { id }
        });
    } catch (error) {
        next(error);
    }
});

// Apply error handler
router.use(errorHandler);

module.exports = router; 