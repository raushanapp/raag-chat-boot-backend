# RAG Chatbot Backend

A real-time intelligent chatbot backend powered by **Retrieval-Augmented Generation (RAG)** using **Redis** for chat storage, **Qdrant** for vector search, and **Google Gemini AI** for intelligent responses.  

![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)  
![Redis](https://img.shields.io/badge/Redis-v7+-red.svg)  
![License](https://img.shields.io/badge/license-MIT-blue.svg)  

---

## 🚀 Features

- **Real-time Chat** – WebSocket communication with Socket.io  
- **RAG Integration** – Retrieval-Augmented Generation for intelligent answers  
- **Vector Search** – Qdrant vector DB for semantic similarity search  
- **AI-Powered** – Google Gemini Pro for response generation  
- **Chat History** – Redis-based message storage and retrieval  
- **Session Management** – UUID-based chat sessions  
- **News Integration** – RSS parsing for article ingestion  
- **RESTful API** – Express.js endpoints  
- **Real-time Communication** – WebSocket support for instant messaging  

---

## 🛠️ Tech Stack

- **Runtime:** Node.js  
- **Framework:** Express.js v5.1.0  
- **Real-time:** Socket.io v4.8.1  
- **Database:** Redis v5.8.2 (chat storage)  
- **Vector DB:** Qdrant Cloud v1.15.1  
- **AI Models:**  
  - Google Gemini Pro v0.24.1 (text generation)  
  - Jina AI (text embeddings)  
- **HTTP Client:** Axios v1.12.1  
- **Web Scraping:** Cheerio v1.1.2  
- **RSS Parsing:** RSS-Parser v3.13.0  
- **UUID Generation:** UUID v13.0.0  

---

## 📋 Prerequisites

Before running this project, make sure you have:  
- **Node.js** (v18 or higher)  
- **Yarn** or **npm** package manager  
- **Redis** server running locally  
- **Qdrant Cloud** account & API key  
- **Google Gemini API key**  
- **Jina AI API key**  

---

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/raushanapp/raag-chat-boot-backend.git
cd raag-chat-boot-backend
```
### Dependencies

``` yarn install
# or
npm install

```

### Set up environment variables

``` PORT=4009
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your-google-gemini-api-key-here
JINA_API_KEY=your-jina-ai-api-key-here
QDRANT_URL=https://your-qdrant-cloud-url:6333
QDRANT_API_KEY=your-qdrant-api-key-here
FRONTEND_URL=http://localhost:5173
```
### Quick start

``` yarn redis:start   # Start Redis
yarn dev           # Start backend server
```
### Both start
``` yarn dev:full

```
###  Redis Management

``` yarn redis:start
yarn redis:stop

yarn redis:restart

yarn redis:status

yarn redis:ping
```

### API Endpoints

### Create New Session
```
curl -X POST http://localhost:4009/api/chat/session
Response :
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```
### Get Chat History 

``` curl http://localhost:4009/api/chat/history/{sessionId}
Response:
{
  "message": [
    {
      "type": "user",
      "message": "Hello",
      "timeStamp": "2025-09-14T08:00:00.000Z"
    },
    {
      "type": "bot",
      "message": "Hi! How can I help you?",
      "timeStamp": "2025-09-14T08:00:05.000Z"
    }
  ]
}
```

### Clear Chat Session
``` curl -X DELETE http://localhost:4009/api/chat/session/{sessionId}
Response:
{
  "message": "Session cleared successfully"
}
```
