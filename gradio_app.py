import os
import json
import openai
import requests
import gradio as gr
from typing import List, Dict, Any
from bs4 import BeautifulSoup
from tqdm import tqdm
import markdown2

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Filter, PointStruct

# Configuration - Replace with environment variables in production
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "YOUR_QDRANT_API_KEY")
QDRANT_URL = os.environ.get("QDRANT_URL", "YOUR_QDRANT_URL")
COLLECTION_NAME = os.environ.get("QDRANT_COLLECTION_NAME", "rbi_circulars")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-3.5-turbo")

# Initialize clients
client = openai.OpenAI(api_key=OPENAI_API_KEY)
qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

def get_embedding(text: str) -> List[float]:
    """Generate embeddings for the given text."""
    response = client.embeddings.create(
        input=text,
        model=EMBEDDING_MODEL
    )
    return response.data[0].embedding

def search_circulars(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Search for relevant circulars based on the query."""
    query_embedding = get_embedding(query)
    
    # Version-agnostic approach to search in Qdrant
    try:
        # Try multiple approaches to handle different Qdrant client versions
        try:
            # First try the newer API (1.1.0+)
            search_results = qdrant_client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_embedding,
                limit=limit
            )
        except (TypeError, AssertionError):
            # Try alternative approach with explicit models
            search_request = models.SearchRequest(
                vector=query_embedding,
                limit=limit
            )
            search_results = qdrant_client.search(
                collection_name=COLLECTION_NAME,
                search_request=search_request
            )
    except Exception as e:
        print(f"Error with search methods: {str(e)}")
        try:
            # Last resort: Try query_points for newest versions
            search_results = qdrant_client.query_points(
                collection_name=COLLECTION_NAME,
                vector=query_embedding,
                limit=limit
            ).points
        except Exception as e2:
            print(f"Error with query_points: {str(e2)}")
            # If all else fails, return empty results
            return []
    
    results = []
    for result in search_results:
        results.append({
            "score": getattr(result, "score", 0.0),
            "circular_number": result.payload.get("circular_number", "N/A"),
            "title": result.payload.get("title", "Untitled"),
            "department": result.payload.get("department", "N/A"),
            "date": result.payload.get("date", "N/A"),
            "meant_for": result.payload.get("meant_for", "N/A"),
            "link": result.payload.get("link", "#"),
            "preview": result.payload.get("text", "No preview available")
        })
    
    return results

def fetch_full_circular_content(url: str) -> str:
    """Fetch the full content of a circular from its URL."""
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        content_div = soup.find('div', class_='content')
        if content_div:
            return content_div.get_text(strip=True)
        else:
            return "Full content could not be extracted. Please visit the original link."
    except Exception as e:
        return f"Error fetching content: {str(e)}"

def generate_response(query: str, retrieved_docs: List[Dict[str, Any]]) -> str:
    """Generate an LLM response based on the query and retrieved documents."""
    if not retrieved_docs:
        return "No relevant documents were found to answer your query. Please try a different question."
    
    context = ""
    for i, doc in enumerate(retrieved_docs):
        context += f"Document {i+1}:\n"
        context += f"Title: {doc['title']}\n"
        context += f"Circular Number: {doc['circular_number']}\n"
        context += f"Department: {doc['department']}\n"
        context += f"Date: {doc['date']}\n"
        context += f"Preview: {doc['preview']}\n\n"
    
    prompt = f"""You are an RBI policy expert. Use the following RBI circulars to answer the user's question.
If the information is not in the circulars, say you don't know.

User Query: {query}

Retrieved Circulars:
{context}

Please provide a comprehensive answer based on the information in these circulars.
"""
    
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant specializing in RBI policies and circulars."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error generating response: {str(e)}"

def format_results_html(results: List[Dict[str, Any]]) -> str:
    """Format the search results as HTML for display."""
    if not results:
        return "<div>No relevant circulars found.</div>"
        
    html = "<div style='font-family: Arial, sans-serif;'>"
    
    for i, result in enumerate(results):
        relevance = int(result.get("score", 0) * 100)
        html += f"""
        <div style='margin-bottom: 20px; padding: 15px; border-radius: 8px; background-color: #f9f9f9; border-left: 5px solid #2c5282;'>
            <h3 style='color: #2c5282; margin-top: 0;'>{result["title"]}</h3>
            <div style='display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;'>
                <span style='background-color: #e2e8f0; padding: 5px 10px; border-radius: 15px; font-size: 12px;'>
                    <strong>Circular:</strong> {result["circular_number"]}
                </span>
                <span style='background-color: #e2e8f0; padding: 5px 10px; border-radius: 15px; font-size: 12px;'>
                    <strong>Department:</strong> {result["department"]}
                </span>
                <span style='background-color: #e2e8f0; padding: 5px 10px; border-radius: 15px; font-size: 12px;'>
                    <strong>Date:</strong> {result["date"]}
                </span>
                <span style='background-color: #e2e8f0; padding: 5px 10px; border-radius: 15px; font-size: 12px;'>
                    <strong>Relevance:</strong> {relevance}%
                </span>
            </div>
            <div style='margin-bottom: 10px;'>
                <p style='margin: 0;'>{result["preview"][:300]}...</p>
            </div>
            <div>
                <a href='{result["link"]}' target='_blank' style='color: #3182ce; text-decoration: none;'>View Original Circular →</a>
            </div>
        </div>
        """
    
    html += "</div>"
    return html

def rag_query(query, num_results=5):
    """Main RAG function that handles the entire process."""
    if not query or not isinstance(query, str) or not query.strip():
        return "Please enter a valid query.", ""
    
    # Ensure num_results is an integer
    try:
        num_results = int(num_results)
    except (TypeError, ValueError):
        num_results = 5  # Default to 5 if conversion fails
    
    try:
        retrieved_docs = search_circulars(query, limit=num_results)
        
        if not retrieved_docs:
            return "No relevant circulars found for your query. Please try different search terms.", ""
        
        llm_response = generate_response(query, retrieved_docs)
        formatted_results = format_results_html(retrieved_docs)
        
        return llm_response, formatted_results
    except Exception as e:
        error_message = f"An error occurred while processing your query: {str(e)}"
        print(error_message)  # Log the error
        return error_message, ""

# Create the Gradio interface
def create_interface():
    """Create the Gradio interface."""
    with gr.Blocks(theme=gr.themes.Soft()) as demo:
        gr.Markdown("# RBI Circulars RAG System")
        gr.Markdown("Query the RBI Circulars database using natural language")
        
        with gr.Row():
            with gr.Column(scale=4):
                query_input = gr.Textbox(
                    label="Your Query",
                    placeholder="E.g., What are the recent changes to prudential norms for urban cooperative banks?",
                    lines=2
                )
            with gr.Column(scale=1):
                num_results = gr.Slider(
                    minimum=1,
                    maximum=10,
                    value=5,
                    step=1,
                    label="Number of Results"
                )
        
        submit_btn = gr.Button("Search", variant="primary")
        
        with gr.Row():
            with gr.Column():
                response_output = gr.Markdown(label="AI Response")
        
        with gr.Row():
            results_output = gr.HTML(label="Retrieved Circulars")
        
        submit_btn.click(
            fn=rag_query,
            inputs=[query_input, num_results],
            outputs=[response_output, results_output]
        )
        
        gr.Examples(
            examples=[
                ["What are the recent changes to prudential norms for urban cooperative banks?"],
                ["Explain the guidelines for digital lending"],
                ["What are the regulations for NBFCs regarding loan recovery?"],
                ["Latest updates on UPI payment systems"]
            ],
            inputs=query_input
        )
        
        return demo

# Create Gradio app for Render deployment
app = create_interface()

# Entry point for the application
if __name__ == "__main__":
    # Run locally when executed directly
    port = int(os.environ.get("PORT", 7860))
    app.launch(server_name="0.0.0.0", server_port=port)
