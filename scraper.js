"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SatoruScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = require("cheerio");
const node_fetch_1 = __importDefault(require("node-fetch"));
const headers_1 = require("./utils/headers");
const cache_1 = require("./config/cache");

class SatoruScraper {
    baseUrl;
    headers;
    constructor(baseUrl = 'https://satoru.one') {
        this.baseUrl = baseUrl;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async createBrowser() {
        throw new Error('Method not implemented.');
    }

    async getAnimeInfo(animeId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                const response = await axios_1.default.get(`${this.baseUrl}/watch/${animeId}`, {
                    headers: this.headers
                });
                const $ = (0, cheerio_1.load)(response.data);
                const title = $('.anime-info h1').text().trim();
                const image = $('.anime-info img').attr('src') || '';
                const description = $('.anime-info .description').text().trim();
                const genres = $('.anime-info .genres a').map((_, el) => $(el).text().trim()).get();
                const status = $('.anime-info .status').text().trim();
                const type = $('.anime-info .type').text().trim();
                const rating = $('.anime-info .rating').text().trim();
                const releaseDate = $('.anime-info .released').text().trim();
                return {
                    id: animeId,
                    title,
                    image,
                    description,
                    genres,
                    status,
                    type,
                    rating,
                    releaseDate
                };
            }
            catch (error) {
                console.error('Error getting anime info:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async getEpisodeServers(episodeId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                const response = await axios_1.default.get(`${this.baseUrl}/ajax/episode/servers?episodeId=${episodeId}`, { headers: this.headers });
                if (!response.data.status) {
                    throw new Error('Failed to get servers');
                }
                const $ = (0, cheerio_1.load)(response.data.html);
                const servers = [];
                $('.server-item').each((_, element) => {
                    const $element = $(element);
                    const id = $element.attr('data-id');
                    const name = $element.find('a').text().trim();
                    const type = $element.attr('data-type');
                    if (id) {
                        servers.push({ id, name, type });
                    }
                });
                return servers;
            }
            catch (error) {
                console.error('Error getting episode servers:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async getStreamingUrl(serverId) {
        try {
            console.log('Getting source URL for server:', serverId);
            const response = await axios_1.default.get(`${this.baseUrl}/ajax/episode/sources?id=${serverId}`, { headers: this.headers });
            console.log('Source response:', response.data);
            
            if (!response.data || !response.data.link) {
                throw new Error('Failed to get streaming URL');
            }

            const initialUrl = response.data.link;
            console.log('Initial URL:', initialUrl);

            // Check if the URL is already an HLS stream
            if (initialUrl.includes('.m3u8')) {
                return [{
                    url: initialUrl,
                    quality: 'auto',
                    isM3U8: true
                }];
            }

            // If not HLS, fetch the page and look for embedded HLS
            const pageResponse = await (0, node_fetch_1.default)(initialUrl);
            const html = await pageResponse.text();

            // Try to find HLS stream in the page
            const m3u8Match = html.match(/(?:"|')([^"']*?master\.m3u8[^"']*?)(?:"|')/i);
            if (m3u8Match && m3u8Match[1]) {
                const masterPlaylistUrl = m3u8Match[1];
                return [{
                    url: masterPlaylistUrl,
                    quality: 'auto',
                    isM3U8: true
                }];
            }

            // If no HLS found, return as embed URL
            return [{
                url: initialUrl,
                quality: 'auto',
                isEmbed: true
            }];

        } catch (error) {
            console.error('Error getting streaming URL:', error);
            throw error;
        }
    }

    async getVideoSources(animeId, episodeId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                this.updateReferer(animeId, episodeId);
                const servers = await this.getEpisodeServers(episodeId, {
                    key: `servers:${episodeId}`,
                    duration: cacheConfig.duration
                });
                if (!servers.length) {
                    throw new Error('No servers found');
                }
                const sources = await Promise.all(servers.map(async (server) => {
                    try {
                        return await this.getStreamingUrl(server.id);
                    }
                    catch (error) {
                        console.warn(`Failed to get source from server ${server.id}:`, error);
                        return null;
                    }
                }));
                return sources.filter((source) => source !== null).flat();
            }
            catch (error) {
                console.error('Error getting video sources:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async getEpisodes(animeId, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                const response = await axios_1.default.get(`${this.baseUrl}/ajax/episode/list/${animeId}`, {
                    headers: this.headers
                });

                if (!response.data.status || !response.data.html) {
                    throw new Error('Failed to get episodes list');
                }

                const $ = (0, cheerio_1.load)(response.data.html);
                const episodes = [];

                $('.ep-item').each((_, element) => {
                    const $element = $(element);
                    const id = $element.attr('data-id') || '';
                    const number = parseInt($element.attr('data-number') || '0');
                    const title = $element.find('.ep-name').attr('title')?.trim() || '';
                    const japaneseTitle = $element.find('.ep-name').attr('data-jname')?.trim() || '';

                    episodes.push({
                        id,
                        number,
                        title,
                        japaneseTitle
                    });
                });

                return {
                    episodes,
                    totalEpisodes: episodes.length
                };
            } catch (error) {
                console.error('Error getting episodes:', error);
                throw error;
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    async search(query, page = 1, cacheConfig) {
        return cache_1.cache.getOrSet(async () => {
            try {
                const url = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}`;
                const response = await axios_1.default.get(url, { headers: this.headers });
                const $ = (0, cheerio_1.load)(response.data);
                const results = [];
                $('.flw-item').each((i, el) => {
                    const $el = $(el);
                    const title = $el.find('.film-name .dynamic-name').text().trim();
                    const image = $el.find('.film-poster-ahref').attr('href');
                    const id = parseInt($el.find('.film-poster-ahref').data('id'));
                    const type = $el.find('.fd-infor .fdi-item').first().text().trim();

                    if (title && image && id) {
                        // Convert title to URL-friendly format
                        const urlTitle = title.toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
                            .replace(/\s+/g, '-')          // Replace spaces with hyphens
                            .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
                            .trim();                       // Trim any leading/trailing hyphens

                        results.push({
                            id,
                            title: urlTitle,
                            image,
                            type
                        });
                    }
                });
                const hasNextPage = $('.pre-pagination .page-link').length > 0;
                const currentPage = page;
                const totalResults = parseInt($('.total-results').text().trim()) || undefined;
                return {
                    success: true,
                    data: {
                        results,
                        currentPage,
                        hasNextPage,
                        totalResults
                    }
                };
            }
            catch (error) {
                console.error('Error searching anime:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }, cacheConfig.key, cacheConfig.duration);
    }

    updateReferer(animeId, episodeId) {
        this.headers.Referer = `${this.baseUrl}/watch/${animeId}?ep=${episodeId}`;
    }

    async getSatoruAnimeId(title, cacheConfig) {
        try {
            const url = `${this.baseUrl}/watch/${title}`;
            const response = await axios_1.default.get(url, {
                headers: this.headers
            });
            const html = response.data;

            const movieIdMatch = html.match(/const movieId = (\d+);/);
            if (!movieIdMatch) {
                throw new Error('Could not find anime ID');
            }

            return parseInt(movieIdMatch[1]);
        } catch (error) {
            console.error('Error in getSatoruAnimeId:', error);
            throw error;
        }
    }
}
exports.SatoruScraper = SatoruScraper;

module.exports = {
    SatoruScraper,
    getSatoruAnimeId: SatoruScraper.prototype.getSatoruAnimeId
};
