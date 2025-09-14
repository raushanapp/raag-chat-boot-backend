const { QdrantClient } = require("@qdrant/js-client-rest");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");


class RagService{
    constructor() {
        this.qdrantClient = new QdrantClient({ url: process.env.QDRANT_URL,apiKey:process.env.QDRANT_API_KEY});
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        this.collectionName = "news_articles";
    }

    async initialize() {
        try {
            // Delete collection if it exists (for development)
            try {
            
                await this.qdrantClient.deleteCollection(this.collectionName);
                console.log('Deleted existing collection');
            } catch (error) {
                // Ignore if collection doesn't exist
            }
            //  creating a collection if  it does not exist;
            await this.qdrantClient.createCollection(this.collectionName, {
                vectors: {
                    size: 768, // jina embedding size
                    distance: "Cosine",
                }
            });
            // console.log('Qdrant collection initialized');
        } catch (error) {
            if (error.status === 409 || error.message?.includes("already exists") ||  error.data?.status?.error?.includes("already exists")) {
                console.log('Qdrant collection already exists, skipping creation');
                return;
            }
            throw error;
        }
    }

    // get Embedding
    async getEmbeddingText(text) {
        // Using Jina AI embeddings (free tier)
        try {
            const response = await axios.post("https://api.jina.ai/v1/embeddings",
                {
                    model: 'jina-embeddings-v2-base-en',
                    input: [text],
                },
                {
                    headers: {
                        "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
                        "Content-Type": "application/json",
                    }
                }
            );
            return response.data.data[0].embedding;
        } catch (error) {
            console.error('Embedding error:', error);
            throw error;
        }
    }
    //  storing 
    async storeEmbedding(id, text, metadata) {
        const embedding = await this.getEmbeddingText(text);
        await this.qdrantClient.upsert(this.collectionName, {
            points: [{
                id: id,
                vector: embedding,
                payload: {
                    text: text,
                    ...metadata
                }
            }]
        });
    };
    //  search query similar
    async searchSimilar(query, topK = 5) {
        const queryEmbedding = await this.getEmbeddingText(query);
        const searchResult = await this.qdrantClient.search(this.collectionName, {
            vector: queryEmbedding,
            limit: topK,
            with_payload: true,
        });
        return searchResult.map((result) => ({ text: result.payload.text, score: result.score, metadata: result.payload }));
    }
    //  generate response data form query
    async generateResponse(query) {
        try {
            //  response data 
            const docs = await this.searchSimilar(query, 3);
            if (docs.lenght === 0) {
                return "I don't have enough information to answer that question. Please try asking about recent news topics.";
            }
            //  create context from retrived docs
            const context = docs.map((doc) => doc.text).join("\n\n");
             // Generate response using Gemini
            const prompt = `Context from news articles:${context}Question: ${query}Based on the provided news context, please provide a comprehensive and accurate answer. If the context doesn't contain enough information to fully answer the question, please say so.Answer:`;
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('RAG generation error:', error);
            return "I'm sorry, I encountered an error while processing your question. Please try again.";
        }
    }
}
module.exports = new RagService();