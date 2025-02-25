# NPCI-RAG

This project is a LLM-powered Document Intelligence (DI) System that utilizes RAG (Retrieval-Augmented Generation) with Gemini 2.0, Qdrant for vector storage, and Hugging Face embeddings to provide efficient document querying and chatbot capabilities. We have extracted data from 50+ PDFs to sample our knowledge base and fine tuned LLM RAG for operation.


## Tech Stack

**Frontend** - Streamlit

**Backend** - Firebase, Toranado server

**Database** - Firestore

**LLM** - OpenAI GPT 3.5 turbo


## Roadmap

✅ MVP Development – Extract JSON data, generate embeddings, store in Qdrant, integrate GPT 3,5 turbo.
✅ Core System – Build Firebase backend, Streamlit UI, optimize RAG pipeline, add structured responses.
✅ Scaling & Performance – Improve query speed, deploy on GCP/AWS, add monitoring (Prometheus/Grafana).
✅ Advanced Features – Multi-modal support, user personalization, auto-summarization, enterprise integration.


## Documentation

Our tool enables users to quickly access key insights from large document repositories. By leveraging AI-powered search and retrieval, it transforms complex, unstructured data into meaningful, structured responses.

- Instant Answers: Query the system in natural language and get relevant information within seconds.

- Enhanced Accuracy: Uses AI-powered RAG and vector search to retrieve precise details.

- User-Friendly Chatbot Interface: Easily interact with the system via an intuitive chat experience.

- Scalable & Secure: Built for high performance and secure enterprise deployment.

- Supports Large Datasets: Handles vast amounts of structured and unstructured documents efficiently.


## Run Locally

Clone the project

```bash
  git clone <link>
```

Go to the project directory

```bash
  cd <path>
```
Create a virtualenv

```bash
  pip install virtualenv

  virtualenv venv
```
Activate venv
```bash
  source path/to/your/activate.sh 

```
start the flask app

```bash
  cd <path>

  python app.py
```


## Authors

🔆 [@Prathik Shetty](https://github.com/prathikshetty2002)

🔆 [@Hrishikesh Yadav](https://www.github.com/Hrishikesh332)

🔆 [@Vikrant Singh](https://www.github.com/vikrantsingh22)


## Contributing

Contributions are always welcome!

See `CONTRIBUTING.md` for ways to get started.

Please adhere to this project's `CODE_OF_CONDUCT.md`.

## Guide

A guideline of project composition and creation.

soon adding `guide.md`

Please adhere to this project's `CODE_OF_CONDUCT.md`.

## Feedback

If you have any feedback, please reach out to us at linuxmint78@gmail.com


## Support

For support join our Slack channel - [AMA](https://ml-geeksworkspace.slack.com/archives/C03K2M9SBAA)

## License

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

