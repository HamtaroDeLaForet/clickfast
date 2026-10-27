# Étape 1 : installation des dépendances (pip et son cache restent ici)
FROM python:3.13.18-alpine3.24 AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --target /deps -r requirements.txt

# Étape 2 : image finale, code et dépendances seulement
FROM python:3.13.18-alpine3.24
ENV PYTHONPATH=/deps PYTHONUNBUFFERED=1
COPY --from=deps /deps /deps
WORKDIR /app
COPY app.py .
RUN adduser -D -H stats
USER stats
EXPOSE 5000
CMD ["python", "app.py"]
