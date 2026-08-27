FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=8s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health', timeout=5)" || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]