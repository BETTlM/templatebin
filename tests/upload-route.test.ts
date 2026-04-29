import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/templates/upload/route";

describe("upload route", () => {
  it("returns 400 when file is missing", async () => {
    const request = new Request("http://localhost/api/templates/upload", {
      method: "POST",
      body: new FormData(),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
