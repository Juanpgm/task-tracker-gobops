/**
 * Tests for src/lib/media-urls.ts.
 * Seam under test: the pure URL-classification/transform functions used to
 * render `fotos_urls` (and `informe_url`) safely, given that the same field
 * mixes two URL shapes with no discriminator:
 *   - migrated data: Google Drive share links (HTML viewer page, not bytes)
 *   - new data: plain S3 URLs (already renderable as <img src>)
 */
import { describe, it, expect } from "vitest";
import {
  extractDriveFileId,
  toDisplayableImageUrl,
  toOriginalUrl,
  isDriveUrl,
} from "./media-urls";

const DRIVE_ID = "1I78N85SMm7CCJKLBWX_np095UQ3EbVne";
const VIEW_URL = `https://drive.google.com/file/d/${DRIVE_ID}/view?usp=drivesdk`;
const OPEN_URL = `https://drive.google.com/open?id=${DRIVE_ID}`;
const UC_URL = `https://drive.google.com/uc?id=${DRIVE_ID}&export=download`;
const S3_URL = "https://catatrack-photos.s3.amazonaws.com/avanzadas/req-1/foto1.jpg";

describe("extractDriveFileId", () => {
  it("extracts the id from a /file/d/{id}/view share link", () => {
    expect(extractDriveFileId(VIEW_URL)).toBe(DRIVE_ID);
  });

  it("extracts the id from an /open?id={id} link", () => {
    expect(extractDriveFileId(OPEN_URL)).toBe(DRIVE_ID);
  });

  it("extracts the id from a /uc?id={id}&export=download link", () => {
    expect(extractDriveFileId(UC_URL)).toBe(DRIVE_ID);
  });

  it("returns null for a plain S3 URL", () => {
    expect(extractDriveFileId(S3_URL)).toBeNull();
  });

  it("returns null for null", () => {
    expect(extractDriveFileId(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(extractDriveFileId(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractDriveFileId("")).toBeNull();
  });

  it("returns null for a malformed, unparseable URL string", () => {
    expect(extractDriveFileId("not a url at all")).toBeNull();
  });

  it("returns null for a Drive folder link with no file id", () => {
    expect(extractDriveFileId("https://drive.google.com/drive/folders/abc123")).toBeNull();
  });

  it("returns null for a bare Drive host with no path or id", () => {
    expect(extractDriveFileId("https://drive.google.com/")).toBeNull();
  });

  it("does not treat an arbitrary domain containing 'drive' as a Drive host", () => {
    expect(extractDriveFileId("https://notdrive.google.com.evil.com/file/d/xyz/view")).toBeNull();
  });
});

describe("isDriveUrl", () => {
  it("is true for Drive share links", () => {
    expect(isDriveUrl(VIEW_URL)).toBe(true);
  });

  it("is false for S3 URLs", () => {
    expect(isDriveUrl(S3_URL)).toBe(false);
  });

  it("is false for null/undefined/empty", () => {
    expect(isDriveUrl(null)).toBe(false);
    expect(isDriveUrl(undefined)).toBe(false);
    expect(isDriveUrl("")).toBe(false);
  });
});

describe("toDisplayableImageUrl", () => {
  it("converts a Drive /view link to the thumbnail endpoint with the default size (w400)", () => {
    expect(toDisplayableImageUrl(VIEW_URL)).toBe(
      `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w400`
    );
  });

  it("honors an explicit size parameter", () => {
    expect(toDisplayableImageUrl(VIEW_URL, "w1200")).toBe(
      `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w1200`
    );
    expect(toDisplayableImageUrl(VIEW_URL, "w200")).toBe(
      `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w200`
    );
  });

  it("returns a non-Drive (S3) URL unchanged, ignoring the size param", () => {
    expect(toDisplayableImageUrl(S3_URL)).toBe(S3_URL);
    expect(toDisplayableImageUrl(S3_URL, "w1200")).toBe(S3_URL);
  });

  it("returns an empty string for null/undefined/empty input", () => {
    expect(toDisplayableImageUrl(null)).toBe("");
    expect(toDisplayableImageUrl(undefined)).toBe("");
    expect(toDisplayableImageUrl("")).toBe("");
  });

  it("returns a malformed URL string unchanged (not a Drive link, nothing to rewrite)", () => {
    expect(toDisplayableImageUrl("not a url")).toBe("not a url");
  });
});

describe("toOriginalUrl", () => {
  it("preserves the human-openable /view link for a Drive file", () => {
    expect(toOriginalUrl(VIEW_URL)).toBe(`https://drive.google.com/file/d/${DRIVE_ID}/view`);
  });

  it("normalizes other Drive share forms to the canonical /view link", () => {
    expect(toOriginalUrl(OPEN_URL)).toBe(`https://drive.google.com/file/d/${DRIVE_ID}/view`);
    expect(toOriginalUrl(UC_URL)).toBe(`https://drive.google.com/file/d/${DRIVE_ID}/view`);
  });

  it("returns a non-Drive (S3) URL unchanged", () => {
    expect(toOriginalUrl(S3_URL)).toBe(S3_URL);
  });

  it("returns an empty string for null/undefined/empty input", () => {
    expect(toOriginalUrl(null)).toBe("");
    expect(toOriginalUrl(undefined)).toBe("");
    expect(toOriginalUrl("")).toBe("");
  });

  it("returns a malformed URL string unchanged", () => {
    expect(toOriginalUrl("not a url")).toBe("not a url");
  });
});
