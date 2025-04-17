/**
 * Elasticsearch utility for Knowledge Garden
 * Provides helper functions for Elasticsearch operations
 */

const { Client } = require('@elastic/elasticsearch');
const config = require('../config');
const logger = require('./logger');

// Create Elasticsearch client
const client = new Client({
  node: config.elasticsearch.node,
  auth: config.elasticsearch.auth.username 
    ? {
        username: config.elasticsearch.auth.username,
        password: config.elasticsearch.auth.password
      } 
    : undefined,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Initialize Elasticsearch indices and mappings
 * @returns {Promise<boolean>} Success status
 */
const initializeIndices = async () => {
  try {
    // Check if Elasticsearch is running
    await client.ping();
    logger.info('Elasticsearch connection successful');

    // Create resources index if it doesn't exist
    const resourcesIndexExists = await client.indices.exists({ 
      index: config.elasticsearch.indices.resources 
    });

    if (!resourcesIndexExists) {
      await client.indices.create({
        index: config.elasticsearch.indices.resources,
        body: {
          settings: {
            analysis: {
              analyzer: {
                custom_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding', 'synonym']
                }
              },
              filter: {
                synonym: {
                  type: 'synonym',
                  synonyms: [
                    'university, college',
                    'assignment, homework, task',
                    'lecture, class, course'
                  ]
                }
              }
            }
          },
          mappings: {
            properties: {
              title: { 
                type: 'text',
                analyzer: 'custom_analyzer',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              description: { 
                type: 'text',
                analyzer: 'custom_analyzer'
              },
              resourceType: { 
                type: 'keyword'
              },
              tags: { 
                type: 'keyword'
              },
              categories: { 
                type: 'keyword'
              },
              owner: {
                type: 'keyword'
              },
              ownerName: {
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              visibility: {
                type: 'keyword'
              },
              isVerified: {
                type: 'boolean'
              },
              verifiedBy: {
                type: 'keyword'
              },
              verificationDate: {
                type: 'date'
              },
              createdAt: {
                type: 'date'
              },
              updatedAt: {
                type: 'date'
              },
              averageRating: {
                type: 'float'
              },
              viewCount: {
                type: 'integer'
              },
              downloadCount: {
                type: 'integer'
              },
              collections: {
                type: 'keyword'
              },
              status: {
                type: 'keyword'
              },
              featured: {
                type: 'boolean'
              },
              subject: {
                type: 'keyword'
              },
              isFeatured: {
                type: 'boolean'
              }
            }
          }
        }
      });
      logger.info(`Created Elasticsearch index: ${config.elasticsearch.indices.resources}`);
    }

    // Create users index if it doesn't exist
    const usersIndexExists = await client.indices.exists({ 
      index: config.elasticsearch.indices.users 
    });

    if (!usersIndexExists) {
      await client.indices.create({
        index: config.elasticsearch.indices.users,
        body: {
          mappings: {
            properties: {
              name: { 
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              email: { 
                type: 'keyword'
              },
              role: { 
                type: 'keyword'
              },
              institution: { 
                type: 'keyword'
              },
              department: { 
                type: 'keyword'
              },
              isVerified: {
                type: 'boolean'
              },
              isActive: {
                type: 'boolean'
              },
              createdAt: {
                type: 'date'
              }
            }
          }
        }
      });
      logger.info(`Created Elasticsearch index: ${config.elasticsearch.indices.users}`);
    }

    // Create collections index if it doesn't exist
    const collectionsIndexExists = await client.indices.exists({ 
      index: config.elasticsearch.indices.collections 
    });

    if (!collectionsIndexExists) {
      await client.indices.create({
        index: config.elasticsearch.indices.collections,
        body: {
          mappings: {
            properties: {
              name: { 
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              description: { 
                type: 'text'
              },
              owner: { 
                type: 'keyword'
              },
              ownerName: { 
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              parentCollection: { 
                type: 'keyword'
              },
              visibility: {
                type: 'keyword'
              },
              resources: {
                type: 'keyword'
              },
              createdAt: {
                type: 'date'
              },
              updatedAt: {
                type: 'date'
              }
            }
          }
        }
      });
      logger.info(`Created Elasticsearch index: ${config.elasticsearch.indices.collections}`);
    }
    
    // Create tags index if it doesn't exist
    const tagsIndexExists = await client.indices.exists({ 
      index: config.elasticsearch.indices.tags 
    });

    if (!tagsIndexExists) {
      await client.indices.create({
        index: config.elasticsearch.indices.tags,
        body: {
          mappings: {
            properties: {
              name: { 
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              description: { 
                type: 'text'
              },
              usageCount: {
                type: 'integer'
              },
              isSystemTag: {
                type: 'boolean'
              },
              createdBy: {
                type: 'keyword'
              },
              createdAt: {
                type: 'date'
              },
              updatedAt: {
                type: 'date'
              }
            }
          }
        }
      });
      logger.info(`Created Elasticsearch index: ${config.elasticsearch.indices.tags}`);
    }
    
    // Create categories index if it doesn't exist
    const categoriesIndexExists = await client.indices.exists({ 
      index: config.elasticsearch.indices.categories 
    });

    if (!categoriesIndexExists) {
      await client.indices.create({
        index: config.elasticsearch.indices.categories,
        body: {
          mappings: {
            properties: {
              name: { 
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword'
                  }
                }
              },
              description: { 
                type: 'text'
              },
              slug: {
                type: 'keyword'
              },
              parent: {
                type: 'keyword'
              },
              ancestors: {
                type: 'keyword'
              },
              resourceCount: {
                type: 'integer'
              },
              isActive: {
                type: 'boolean'
              },
              createdBy: {
                type: 'keyword'
              },
              createdAt: {
                type: 'date'
              },
              updatedAt: {
                type: 'date'
              }
            }
          }
        }
      });
      logger.info(`Created Elasticsearch index: ${config.elasticsearch.indices.categories}`);
    }

    return true;
  } catch (error) {
    logger.error(`Elasticsearch initialization error: ${error.message}`);
    return false;
  }
};

/**
 * Index a document in Elasticsearch
 * @param {string} index - Index name
 * @param {string} id - Document ID
 * @param {object} document - Document to index
 * @returns {Promise<object>} Elasticsearch response
 */
const indexDocument = async (index, id, document) => {
  try {
    const response = await client.index({
      index,
      id,
      document,
      refresh: true // Make the change immediately available for search
    });
    logger.debug(`Indexed document in ${index}: ${id}`);
    return response;
  } catch (error) {
    logger.error(`Error indexing document in ${index}: ${error.message}`);
    throw error;
  }
};

/**
 * Update a document in Elasticsearch
 * @param {string} index - Index name
 * @param {string} id - Document ID
 * @param {object} document - Document updates
 * @returns {Promise<object>} Elasticsearch response
 */
const updateDocument = async (index, id, document) => {
  try {
    const response = await client.update({
      index,
      id,
      doc: document,
      refresh: true
    });
    logger.debug(`Updated document in ${index}: ${id}`);
    return response;
  } catch (error) {
    logger.error(`Error updating document in ${index}: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a document from Elasticsearch
 * @param {string} index - Index name
 * @param {string} id - Document ID
 * @returns {Promise<object>} Elasticsearch response
 */
const deleteDocument = async (index, id) => {
  try {
    const response = await client.delete({
      index,
      id,
      refresh: true
    });
    logger.debug(`Deleted document from ${index}: ${id}`);
    return response;
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) {
      logger.warn(`Document not found in ${index}: ${id}`);
      return { result: 'not_found' };
    }
    logger.error(`Error deleting document from ${index}: ${error.message}`);
    throw error;
  }
};

/**
 * Search for documents in Elasticsearch
 * @param {string} index - Index name
 * @param {object} query - Elasticsearch query DSL
 * @param {object} options - Additional options (size, from, sort, highlight, aggregations)
 * @returns {Promise<object>} Search results
 */
const search = async (index, query, options = {}) => {
  try {
    const { size = 10, from = 0, sort, highlight, aggregations } = options;
    
    const searchParams = {
      index,
      size,
      from,
      body: { query }
    };
    
    if (sort) {
      searchParams.body.sort = sort;
    }
    
    if (highlight) {
      searchParams.body.highlight = highlight;
    }
    
    if (aggregations) {
      searchParams.body.aggs = aggregations;
    }
    
    const response = await client.search(searchParams);
    
    const result = {
      total: response.hits.total.value,
      hits: response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        highlight: hit.highlight,
        ...hit._source
      }))
    };
    
    if (response.aggregations) {
      result.aggregations = response.aggregations;
    }
    
    return result;
  } catch (error) {
    logger.error(`Error searching in ${index}: ${error.message}`);
    throw error;
  }
};

/**
 * Perform bulk operations in Elasticsearch
 * @param {Array} operations - Array of operations to perform
 * @returns {Promise<object>} Elasticsearch response
 */
const bulk = async (operations) => {
  try {
    const response = await client.bulk({
      refresh: true,
      body: operations
    });
    
    if (response.errors) {
      const errorItems = response.items.filter(item => item.index && item.index.error);
      logger.error(`Bulk operation had errors: ${JSON.stringify(errorItems)}`);
    } else {
      logger.debug(`Bulk operation successful: ${operations.length / 2} documents`);
    }
    
    return response;
  } catch (error) {
    logger.error(`Error in bulk operation: ${error.message}`);
    throw error;
  }
};

/**
 * Perform a full-text search with advanced features
 * @param {string} index - Index name
 * @param {string} searchText - Text to search for
 * @param {Array<string>} fields - Fields to search in
 * @param {object} filters - Filters to apply
 * @param {object} options - Additional options (size, from, sort)
 * @returns {Promise<object>} Search results with highlighting
 */
const fullTextSearch = async (index, searchText, fields, filters = {}, options = {}) => {
  try {
    const { size = 10, from = 0, sort } = options;
    
    // Build query
    const should = [
      {
        multi_match: {
          query: searchText,
          fields,
          type: 'best_fields',
          operator: 'or',
          fuzziness: 'AUTO'
        }
      },
      {
        multi_match: {
          query: searchText,
          fields: fields.map(field => `${field}.keyword`).filter(field => !field.includes('description')),
          type: 'phrase',
          boost: 2
        }
      }
    ];
    
    // Build filters
    const must = [];
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        must.push({
          terms: { [key]: value }
        });
      } else {
        must.push({
          term: { [key]: value }
        });
      }
    }
    
    const query = {
      bool: {
        should,
        must,
        minimum_should_match: 1
      }
    };
    
    // Highlighting configuration
    const highlight = {
      fields: {},
      pre_tags: ['<strong>'],
      post_tags: ['</strong>'],
      fragment_size: 150,
      number_of_fragments: 3
    };
    
    fields.forEach(field => {
      highlight.fields[field] = {};
    });
    
    // Aggregations for faceted search
    const aggregations = {
      resource_types: {
        terms: { field: 'resourceType' }
      },
      categories: {
        terms: { field: 'categories' }
      },
      tags: {
        terms: { field: 'tags', size: 20 }
      },
      avg_rating: {
        avg: { field: 'averageRating' }
      }
    };
    
    return await search(index, query, { size, from, sort, highlight, aggregations });
  } catch (error) {
    logger.error(`Error in full text search for ${index}: ${error.message}`);
    throw error;
  }
};

/**
 * Get auto-suggestions/autocomplete for search queries
 * @param {string} index - Index name
 * @param {string} prefix - Prefix to get suggestions for
 * @param {Array<string>} fields - Fields to get suggestions from
 * @param {number} size - Number of suggestions to return
 * @returns {Promise<Array<string>>} Array of suggestions
 */
const getSuggestions = async (index, prefix, fields, size = 5) => {
  try {
    const queries = fields.map(field => ({
      prefix: { [field]: { value: prefix, boost: 2 } }
    }));
    
    const response = await client.search({
      index,
      size,
      body: {
        _source: fields,
        query: {
          bool: {
            should: queries,
            minimum_should_match: 1
          }
        }
      }
    });
    
    const suggestions = new Set();
    response.hits.hits.forEach(hit => {
      fields.forEach(field => {
        const value = hit._source[field];
        if (value && typeof value === 'string' && 
            value.toLowerCase().includes(prefix.toLowerCase())) {
          suggestions.add(value);
        }
      });
    });
    
    return Array.from(suggestions).slice(0, size);
  } catch (error) {
    logger.error(`Error getting suggestions for ${index}: ${error.message}`);
    throw error;
  }
};

/**
 * Get related resources based on content similarity
 * @param {string} resourceId - ID of the resource to find related items for
 * @param {number} size - Number of related resources to return
 * @returns {Promise<Array<object>>} Related resources
 */
const getRelatedResources = async (resourceId, size = 5) => {
  try {
    // First get the resource details
    const resource = await client.get({
      index: config.elasticsearch.indices.resources,
      id: resourceId
    });
    
    if (!resource.found) {
      throw new Error(`Resource not found with ID: ${resourceId}`);
    }
    
    // Use More Like This query to find similar resources
    const response = await client.search({
      index: config.elasticsearch.indices.resources,
      size,
      body: {
        query: {
          bool: {
            must: [
              {
                more_like_this: {
                  fields: ['title', 'description', 'tags', 'categories'],
                  like: [
                    {
                      _index: config.elasticsearch.indices.resources,
                      _id: resourceId
                    }
                  ],
                  min_term_freq: 1,
                  max_query_terms: 25,
                  min_doc_freq: 1
                }
              }
            ],
            must_not: [
              {
                ids: {
                  values: [resourceId]
                }
              }
            ]
          }
        }
      }
    });
    
    return response.hits.hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      ...hit._source
    }));
  } catch (error) {
    logger.error(`Error getting related resources for ${resourceId}: ${error.message}`);
    throw error;
  }
};

/**
 * Perform a filtered search with aggregations
 * @param {string} index - Index name
 * @param {object} filters - Filters to apply
 * @param {object} options - Additional options (size, from, sort)
 * @returns {Promise<object>} Search results with aggregations
 */
const filteredSearch = async (index, filters = {}, options = {}) => {
  try {
    const { size = 10, from = 0, sort } = options;
    
    // Build filter clauses
    const filterClauses = [];
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        filterClauses.push({
          terms: { [key]: value }
        });
      } else if (typeof value === 'object' && value !== null) {
        // Handle range queries
        if (value.gte !== undefined || value.lte !== undefined) {
          filterClauses.push({
            range: { [key]: value }
          });
        }
      } else {
        filterClauses.push({
          term: { [key]: value }
        });
      }
    }
    
    const query = filterClauses.length > 0 ? {
      bool: {
        filter: filterClauses
      }
    } : { match_all: {} };
    
    // Define aggregations
    const aggregations = {
      resource_types: {
        terms: { field: 'resourceType' }
      },
      categories: {
        terms: { field: 'categories' }
      },
      tags: {
        terms: { field: 'tags', size: 30 }
      },
      rating_distribution: {
        histogram: {
          field: 'averageRating',
          interval: 1,
          min_doc_count: 0,
          extended_bounds: {
            min: 1,
            max: 5
          }
        }
      }
    };
    
    return await search(index, query, { size, from, sort, aggregations });
  } catch (error) {
    logger.error(`Error in filtered search for ${index}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  client,
  initializeIndices,
  indexDocument,
  updateDocument,
  deleteDocument,
  search,
  bulk,
  fullTextSearch,
  getSuggestions,
  getRelatedResources,
  filteredSearch
};
