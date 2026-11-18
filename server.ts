import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  checkFlightRoute,
  FlightNotFoundError,
  sendNtfyNotification,
  type FlightCheckRequest,
} from "./shared/flightChecker.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/api/flights/check", async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<FlightCheckRequest>;
      if (
        !body.originCode ||
        !body.destCode ||
        !body.startDate ||
        !body.endDate
      ) {
        res
          .status(400)
          .json({ error: "출발지, 도착지, 날짜 정보가 필요합니다." });
        return;
      }

      const result = await checkFlightRoute({
        originCode: body.originCode,
        originCity: body.originCity,
        destCode: body.destCode,
        destCity: body.destCity,
        periodMode: body.periodMode === "fixed" ? "fixed" : "flexible",
        startDate: body.startDate,
        endDate: body.endDate,
        stayNights: Number(body.stayNights) || 3,
        stayNightsMax: body.stayNightsMax
          ? Number(body.stayNightsMax)
          : undefined,
        directOnly: Boolean(body.directOnly),
        baselinePrice: body.baselinePrice,
      });

      res.json(result);
    } catch (err: unknown) {
      if (err instanceof FlightNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : "실시간 항공권 조회 중 오류가 발생했습니다.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ntfy/test", async (req: Request, res: Response) => {
    try {
      const { topic, server, title, message, clickUrl } = req.body as {
        topic?: string;
        server?: string;
        title?: string;
        message?: string;
        clickUrl?: string;
      };

      if (!topic || !topic.trim()) {
        res.status(400).json({ error: "ntfy 토픽 이름을 입력해주세요." });
        return;
      }

      await sendNtfyNotification({
        server: server || "https://ntfy.sh",
        topic,
        title: title || "FareWatch 알림 테스트",
        message:
          message ||
          "연결 완료! GitHub Actions가 15분마다 특가 발견 시 이 채널로 푸시합니다.",
        clickUrl,
        priority: 4,
        tags: ["airplane", "white_check_mark"],
      });

      res.json({ ok: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "ntfy 테스트 발송에 실패했습니다.";
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      const indexHtml = path.join(distPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Not found");
      }
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
