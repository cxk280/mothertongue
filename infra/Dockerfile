# GPU inference image. Build context is the repo's server/ directory:
#   docker build -f infra/Dockerfile -t mothertongue-server ./server
#
# Based on the official PyTorch CUDA runtime so torch + CUDA are already present
# and matched — we only layer the app deps on top.
FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    MT_MODE=real \
    MT_DEVICE=cuda \
    HF_HOME=/models

# App deps (torch comes from the base image). requirements.txt is the light base;
# the model libraries are added explicitly so we don't reinstall torch.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    "transformers>=4.40" "sentencepiece>=0.2" "accelerate>=0.30"

COPY app ./app

EXPOSE 8000
# Models cache to /models — mount a volume there to avoid re-downloading on restart.
VOLUME ["/models"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
