/**
 * Search Controller
 * Handles search functionality using Elasticsearch
 */

const elasticsearch = require('../../../utils/elasticsearch');
const config = require('../../../config');
const logger = require('../../../utils/logger');

/**
 * Perform a global search across all indices
 * @route GET /api/search
 * @access Public
 */
const globalSearch = async (req, res, next) => {
  try {
    const { q, limit = 10, page = 1, type } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const size = parseInt(limit);
    const from = (parseInt(page) - 1) * size;
    
    // Fields to search in for each index
    const resourceFields = ['title^3', 'description^2', 'tags', 'ownerName'];
    const userFields = ['name^2', 'institution', 'department'];
    
    // Determine which indices to search based on type parameter
    let indices = [];
    
    if (!type || type === 'all') {
      indices = [
        config.elasticsearch.indices.resources,
        config.elasticsearch.indices.users,
        config.elasticsearch.indices.collections,
        config.elasticsearch.indices.tags
      ];
    } else {
      // Map type to index
      const typeToIndex = {
        resources: config.elasticsearch.indices.resources,
        users: config.elasticsearch.indices.users,
        collections: config.elasticsearch.indices.collections,
        tags: config.elasticsearch.indices.tags
      };
      
      if (typeToIndex[type]) {
        indices = [typeToIndex[type]];
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid search type'
        });
      }
    }
    
    // Prepare response data structure
    const responseData = {
      resources: [],
      users: [],
      collections: [],
      tags: []
    };
    
    try {
      // Perform multi-index search
      const results = await elasticsearch.client.msearch({
        body: indices.flatMap(index => [
          { index },
          {
            query: {
              bool: {
                should: [
                  {
                    multi_match: {
                      query: q,
                      fields: index === config.elasticsearch.indices.resources ? resourceFields : 
                              index === config.elasticsearch.indices.users ? userFields : 
                              ['name^3', 'description^2'],
                      type: 'best_fields',
                      fuzziness: 'AUTO'
                    }
                  }
                ],
                filter: index === config.elasticsearch.indices.resources ? [
                  { term: { visibility: 'public' } },
                  { term: { status: 'active' } }
                ] : []
              }
            },
            highlight: {
              fields: {
                title: { number_of_fragments: 3 },
                name: { number_of_fragments: 3 },
                description: { number_of_fragments: 3 }
              },
              pre_tags: ['<strong>'],
              post_tags: ['</strong>']
            },
            size,
            from
          }
        ])
      });
      
      // Process search results and format response
      if (results && results.responses) {
        results.responses.forEach((response, index) => {
          if (response.hits && response.hits.hits) {
            const hits = response.hits.hits.map(hit => ({
              ...hit._source,
              id: hit._id,
              score: hit._score,
              highlights: hit.highlight
            }));

            // Add hits to appropriate category in response
            const indexName = indices[index];
            if (indexName === config.elasticsearch.indices.resources) {
              responseData.resources = hits;
            } else if (indexName === config.elasticsearch.indices.users) {
              responseData.users = hits;
            } else if (indexName === config.elasticsearch.indices.collections) {
              responseData.collections = hits;
            } else if (indexName === config.elasticsearch.indices.tags) {
              responseData.tags = hits;
            }
          }
        });
      }
    } catch (error) {
      logger.error(`Elasticsearch connection error in global search: ${error.message}`);
      // We'll continue with empty results rather than crashing
    }
    
    // We'll use the responseData object that we created earlier
    // which is already populated with the search results or empty arrays if there was an error
    return res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error(`Error in global search: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      message: 'An error occurred while processing your search. Please try again.'
    });
  }
};

/**
 * Get search suggestions based on partial input
 * @route GET /api/search/suggestions
 * @access Public
 */
const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
    
    // Get suggestions from resources index and tags index with error handling
    let resourceSuggestions = [];
    let tagSuggestions = [];
    
    try {
      resourceSuggestions = await elasticsearch.getSuggestions(
        config.elasticsearch.indices.resources,
        q,
        ['title', 'description', 'tags'],
        parseInt(limit)
      );
      
      tagSuggestions = await elasticsearch.getSuggestions(
        config.elasticsearch.indices.tags,
        q,
        ['name'],
        parseInt(limit)
      );
    } catch (error) {
      console.error('Elasticsearch connection error:', error.message);
      // Continue with empty suggestions instead of crashing
    }
    
    // Combine and deduplicate suggestions
    const allSuggestions = [...resourceSuggestions, ...tagSuggestions];
    const uniqueSuggestions = [...new Set(allSuggestions)];
    
    return res.status(200).json({
      success: true,
      data: uniqueSuggestions.slice(0, parseInt(limit))
    });
  } catch (err) {
    logger.error('Suggestions error:', err);
    next(err);
  }
};

/**
 * Advanced search with filters and facets
 * @route GET /api/search/advanced
 * @access Public
 */
const advancedSearch = async (req, res, next) => {
  try {
    const { 
      q, 
      type = 'resources',
      categories,
      tags,
      resourceType,
      dateFrom,
      dateTo,
      verified,
      sort = 'relevance',
      order = 'desc',
      limit = 10,
      page = 1
    } = req.query;
    
    // Map type to index
    const typeToIndex = {
      resources: config.elasticsearch.indices.resources,
      users: config.elasticsearch.indices.users,
      collections: config.elasticsearch.indices.collections,
      tags: config.elasticsearch.indices.tags
    };
    
    const index = typeToIndex[type] || config.elasticsearch.indices.resources;
    
    // Build filters
    const filters = {};
    
    if (categories) {
      filters.categories = categories.split(',');
    }
    
    if (tags) {
      filters.tags = tags.split(',');
    }
    
    if (resourceType) {
      filters.resourceType = resourceType;
    }
    
    if (verified) {
      filters.isVerified = verified === 'true';
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filters.dateRange = {
        field: 'createdAt',
        gte: dateFrom,
        lte: dateTo
      };
    }
    
    // Always filter for public and active resources
    if (type === 'resources') {
      filters.visibility = 'public';
      filters.status = 'active';
    }
    
    // Build sort options
    const sortOptions = {};
    
    if (sort === 'relevance' && q) {
      // Default relevance sorting by Elasticsearch
      sortOptions._score = order;
    } else if (sort === 'date') {
      sortOptions.createdAt = order;
    } else if (sort === 'rating' && type === 'resources') {
      sortOptions.averageRating = order;
    } else if (sort === 'views' && type === 'resources') {
      sortOptions.viewCount = order;
    } else if (sort === 'downloads' && type === 'resources') {
      sortOptions.downloadCount = order;
    } else if (sort === 'name' || sort === 'title') {
      const field = type === 'resources' ? 'title.keyword' : 'name.keyword';
      sortOptions[field] = order;
    }
    
    // Search options
    const options = {
      size: parseInt(limit),
      from: (parseInt(page) - 1) * parseInt(limit),
      sort: sortOptions,
      highlight: {
        fields: {
          title: {},
          name: {},
          description: {}
        },
        pre_tags: ['<strong>'],
        post_tags: ['</strong>']
      },
      aggregations: {
        resourceTypes: {
          terms: {
            field: 'resourceType',
            size: 10
          }
        },
        categories: {
          terms: {
            field: 'categories',
            size: 20
          }
        },
        tags: {
          terms: {
            field: 'tags',
            size: 20
          }
        },
        verificationStatus: {
          terms: {
            field: 'isVerified'
          }
        }
      }
    };
    
    // Fields to search in
    const fields = type === 'resources' 
      ? ['title^3', 'description^2', 'tags', 'ownerName'] 
      : ['name^2', 'description'];
    
    // Perform search
    let results;
    
    if (q) {
      // Full-text search with filters
      results = await elasticsearch.fullTextSearch(index, q, fields, filters, options);
    } else {
      // Filter-only search
      results = await elasticsearch.filteredSearch(index, filters, options);
    }
    
    // Format results
    const formattedResults = {
      items: results.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
        highlights: hit.highlight || {}
      })),
      facets: {
        resourceTypes: results.aggregations?.resourceTypes?.buckets || [],
        categories: results.aggregations?.categories?.buckets || [],
        tags: results.aggregations?.tags?.buckets || [],
        verificationStatus: results.aggregations?.verificationStatus?.buckets || []
      },
      total: results.hits.total.value
    };
    
    return res.status(200).json({
      success: true,
      data: formattedResults,
      meta: {
        query: q || '',
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.hits.total.value,
        totalPages: Math.ceil(results.hits.total.value / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error('Advanced search error:', err);
    next(err);
  }
};

module.exports = {
  globalSearch,
  getSearchSuggestions,
  advancedSearch
};
