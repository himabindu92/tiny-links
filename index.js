const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const { customAlphabet } = require("nanoid");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Postgres pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")
    ? { rejectUnauthorized: false }
    : false,
});

// Random code generator [A-Za-z0-9]{6-8} – we'll use length 7
const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const generateCode = customAlphabet(alphabet, 7);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static assets
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

/* ---------------------- HEALTH CHECK ---------------------- */

app.get("/healthz", (req, res) => {
  res.status(200).json({
    ok: true,
    version: process.env.APP_VERSION || "1.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ---------------------- BASIC PAGES ----------------------- */

// Dashboard page: /
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Stats page: /code/:code
app.get("/code/:code", (req, res) => {
  res.sendFile(path.join(publicDir, "stats.html"));
});

/* ---------------------- HELPERS --------------------------- */

function normalizeUrl(raw) {
  if (!raw) return null;
  let urlStr = raw.trim();
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = "https://" + urlStr;
  }
  try {
    // Validate URL
    // eslint-disable-next-line no-new
    new URL(urlStr);
    return urlStr;
  } catch {
    return null;
  }
}

function isValidCode(code) {
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

/* ---------------------- API: LINKS ------------------------ */

/**
 * POST /api/links
 * Body can be:
 *  { url, code? } OR
 *  { targetUrl, code? } OR
 *  { originalUrl, code? }
 * Returns 201 on success, 409 if code exists.
 */
app.post("/api/links", async (req, res) => {
  try {
    const { code: customCode } = req.body;
    const longUrl =
      req.body.url || req.body.targetUrl || req.body.originalUrl;

    const normalized = normalizeUrl(longUrl);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    let code = customCode ? customCode.trim() : generateCode();

    if (!isValidCode(code)) {
      return res.status(400).json({
        error: "Code must be 6–8 characters, letters and numbers only",
      });
    }

    // Try inserting; handle duplicate code
    try {
      const insertQuery = `
        INSERT INTO links (code, original_url)
        VALUES ($1, $2)
        RETURNING id, code, original_url, click_count, last_clicked_at, created_at
      `;
      const result = await pool.query(insertQuery, [code, normalized]);
      const link = result.rows[0];

      const base = process.env.BASE_URL || "";
      return res.status(201).json({
        code: link.code,
        shortUrl: `${base}/${link.code}`,
        originalUrl: link.original_url,
        clickCount: link.click_count,
        lastClickedAt: link.last_clicked_at,
        createdAt: link.created_at,
      });
    } catch (err) {
      // Unique constraint violation => duplicate code
      if (err.code === "23505") {
        return res.status(409).json({ error: "Code already exists" });
      }
      console.error("Error inserting link:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  } catch (err) {
    console.error("POST /api/links error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/links
 * List all links (for dashboard).
 */
app.get("/api/links", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    let query = `
      SELECT id, code, original_url, click_count, last_clicked_at, created_at
      FROM links
    `;
    const params = [];

    if (search) {
      query += `
        WHERE code ILIKE $1 OR original_url ILIKE $1
      `;
      params.push(`%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    const base = process.env.BASE_URL || "";

    const data = result.rows.map((row) => ({
      code: row.code,
      shortUrl: `${base}/${row.code}`,
      originalUrl: row.original_url,
      clickCount: row.click_count,
      lastClickedAt: row.last_clicked_at,
      createdAt: row.created_at,
    }));

    res.json(data);
  } catch (err) {
    console.error("GET /api/links error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/links/:code
 * Stats for one code.
 */
app.get("/api/links/:code", async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      `
      SELECT id, code, original_url, click_count, last_clicked_at, created_at
      FROM links
      WHERE code = $1
    `,
      [code]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const row = result.rows[0];
    const base = process.env.BASE_URL || "";
    res.json({
      code: row.code,
      shortUrl: `${base}/${row.code}`,
      originalUrl: row.original_url,
      clickCount: row.click_count,
      lastClickedAt: row.last_clicked_at,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error("GET /api/links/:code error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/links/:code
 * Delete a link.
 */
app.delete("/api/links/:code", async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query("DELETE FROM links WHERE code = $1", [
      code,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/links/:code error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---------------------- REDIRECT ROUTE -------------------- */

/**
 * GET /:code
 * 302 redirect to original URL, increment click_count & last_clicked_at
 */
app.get("/:code", async (req, res) => {
  const { code } = req.params;

  // Safety: avoid catching /favicon.ico or unexpected paths
  if (code === "favicon.ico") {
    return res.status(404).send("Not found");
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        SELECT id, original_url, click_count
        FROM links
        WHERE code = $1
        FOR UPDATE
      `,
        [code]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).send("Not found");
      }

      const link = result.rows[0];

      await client.query(
        `
        UPDATE links
        SET click_count = click_count + 1,
            last_clicked_at = NOW()
        WHERE id = $1
      `,
        [link.id]
      );

      await client.query("COMMIT");

      return res.redirect(302, link.original_url);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Redirect transaction error:", err);
      return res.status(500).send("Internal server error");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /:code error:", err);
    res.status(500).send("Internal server error");
  }
}); 


//test the db 



/* ---------------------- START SERVER ---------------------- */



app.listen(PORT, "0.0.0.0", () => {
  console.log(`TinyLink running on port ${PORT}`);
});

