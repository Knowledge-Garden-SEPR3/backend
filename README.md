# Knowledge Garden Backend

Knowledge Garden is a platform for educational resource sharing, built with a microservices architecture. This repository contains the backend services for the platform.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Elasticsearch (optional, for search functionality)
- Redis (optional, for caching)

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/knowledge-garden.git
cd knowledge-garden/backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit the .env file with your configuration
```

4. Start MongoDB
```bash
# Using Docker
docker run --name mongodb -d -p 27017:27017 mongo

# Or use a local installation
mongod --dbpath=/path/to/data/db
```

5. Start Elasticsearch (optional, for search functionality)
```bash
# macOS with Homebrew
brew services start elasticsearch
```

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm run build
npm start
```

The server will start on the port specified in your .env file (default: 000).
You can access the API at `http://localhost:3000/api`.

## Core Services

### User Service
Handles user authentication and management:
- User registration and login
- JWT-based authentication
- Profile management
- Role-based access control
- Email verification (in development)

API endpoints:
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Authenticate a user
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id/role` - Update user role (admin only)

### Resource Service
Manages educational resources:
- Resource upload and storage
- Resource metadata management
- Download tracking
- Resource visibility control
- File validation

API endpoints:
- `POST /api/resources` - Create a new resource
- `GET /api/resources` - Get all resources
- `GET /api/resources/:id` - Get resource by ID
- `PUT /api/resources/:id` - Update resource
- `DELETE /api/resources/:id` - Delete resource
- `GET /api/resources/user/:userId` - Get resources by user
- `GET /api/resources/download/:id` - Download a resource
- `GET /api/resources/popular` - Get popular resources
- `GET /api/resources/recommended` - Get recommended resources

### Search Service
Provides advanced search functionality using Elasticsearch:
- Global search across all content types
- Advanced search with filters
- Search suggestions
- Faceted search results
- Text highlighting

API endpoints:
- `GET /api/search` - Perform global search
- `GET /api/search/suggestions` - Get search suggestions
- `GET /api/search/advanced` - Perform advanced search with filters

### Tag Service
Manages tagging and categorization:
- Tag creation and management
- Hierarchical categories
- Tag popularity tracking
- Tag suggestions

API endpoints:
- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create a new tag
- `GET /api/tags/:id` - Get tag by ID
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag
- `GET /api/tags/popular` - Get popular tags
- `GET /api/tags/suggestions` - Get tag suggestions

- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create a new category
- `GET /api/categories/:id` - Get category by ID
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `GET /api/categories/:id/subcategories` - Get subcategories

## Utilities

### Authentication Middleware
The backend implements JWT-based authentication:
- `authenticate` - Verifies JWT token
- `authorize` - Checks user roles for access control

### Elasticsearch Integration
Search functionality is powered by Elasticsearch:
- Full-text search
- Fuzzy matching
- Result highlighting
- Faceted search
- Auto-suggestions

### Caching Layer
Redis-based caching for improved performance:
- API response caching
- Popular resources caching
- Search results caching

### Logging System
Comprehensive logging for monitoring and debugging:
- Request logging
- Error logging
- Performance metrics

## Development

### Project Structure
```
backend/
├── config/              # Configuration files
├── middleware/          # Middleware functions
├── services/            # Microservices
│   ├── user-service/    # User management
│   ├── resource-service/# Resource management
│   ├── search-service/  # Search functionality
│   └── tag-service/     # Tagging system
├── utils/               # Utility functions
├── .env                 # Environment variables
├── app.js               # Express application
└── server.js            # Server entry point
```

### Adding New Services
To add a new service:
1. Create a new directory in the `services` folder
2. Implement routes, controllers, and models
3. Register the service routes in `app.js`

## License
This project is licensed under the MIT License.
