#!/usr/bin/env python3
"""Shared Postgres connection helpers for StayFinder scripts."""

from __future__ import annotations

import os
import socket
import sys
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover

    def load_dotenv(*_args: Any, **_kwargs: Any) -> None:
        """No-op if python-dotenv is not installed."""

try:
    import psycopg2
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: pip install psycopg2-binary") from exc


def load_project_env() -> None:
    """Load .env from the current working directory if present."""
    load_dotenv()


def _resolve_first_ipv4(hostname: str) -> str | None:
    try:
        for res in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            return res[4][0]
    except OSError:
        return None
    return None


def _hostaddr_from_env(hostname: str | None) -> str | None:
    explicit = (os.environ.get("PGHOSTADDR") or os.environ.get("SUPABASE_DB_HOSTADDR") or "").strip()
    if explicit:
        return explicit
    if os.environ.get("PGFORCE_IPV4", "").lower() not in ("1", "true", "yes"):
        return None
    if hostname:
        return _resolve_first_ipv4(hostname)
    return None


def _apply_hostaddr_to_url(url: str) -> str:
    parsed = urlparse(url)
    hostaddr = _hostaddr_from_env(parsed.hostname)
    if not hostaddr:
        return url
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if "hostaddr" in query:
        return url
    query["hostaddr"] = hostaddr
    return urlunparse(parsed._replace(query=urlencode(query)))


def connect_from_env():
    """Return psycopg2 connection using DATABASE_URL or PG* variables."""
    url = (os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or "").strip()
    if url:
        return psycopg2.connect(_apply_hostaddr_to_url(url))

    host = (os.environ.get("PGHOST") or os.environ.get("SUPABASE_DB_HOST") or "").strip()
    password = os.environ.get("PGPASSWORD") or os.environ.get("SUPABASE_DB_PASSWORD")
    if host and password:
        port_s = os.environ.get("PGPORT") or os.environ.get("SUPABASE_DB_PORT") or "5432"
        try:
            port = int(port_s)
        except ValueError:
            port = 5432
        kw: dict[str, Any] = {
            "host": host,
            "port": port,
            "user": os.environ.get("PGUSER") or os.environ.get("SUPABASE_DB_USER") or "postgres",
            "password": password,
            "dbname": os.environ.get("PGDATABASE") or os.environ.get("SUPABASE_DB_NAME") or "postgres",
            "sslmode": os.environ.get("PGSSLMODE") or "require",
        }
        hostaddr = _hostaddr_from_env(host)
        if hostaddr:
            kw["hostaddr"] = hostaddr
        return psycopg2.connect(**kw)

    print(
        "Set DATABASE_URL (or SUPABASE_DB_URL), or set PGHOST + PGPASSWORD "
        "(and optionally PGPORT, PGUSER, PGDATABASE, PGSSLMODE).",
        file=sys.stderr,
    )
    raise SystemExit(1)
