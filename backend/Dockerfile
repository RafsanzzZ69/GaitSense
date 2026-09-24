FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libportaudio2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/backend
COPY backend/pyproject.toml backend/constraints.txt ./
COPY backend/app ./app
COPY database/schema-v2.json /workspace/database/schema-v2.json
COPY research/gaitsense_poc/models/pose_landmarker_full.task /workspace/research/gaitsense_poc/models/pose_landmarker_full.task
RUN pip install --no-cache-dir -c constraints.txt '.[vision]' \
    && useradd --create-home --uid 10001 gaitsense \
    && mkdir -p storage && chown gaitsense:gaitsense storage
USER gaitsense
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
