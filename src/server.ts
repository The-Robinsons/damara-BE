import app, { syncDatabase } from "./app";
import ENV from "./common/constants/ENV";
import logger from "jet-logger";
import { connectDB } from "./db";
import { createServer } from "http";
import { setupSocketIO, setIO } from "./config/socket";
import { startTradeReviewPublicationJob } from "./jobs/TradeReviewPublicationJob";

/**
 * server.ts
 * ---------------------------------------------------------------------------
 * - Express 애플리케이션을 구동하는 진입점
 * - DB 연결/초기화가 모두 끝난 뒤에만 서버를 열어 오류를 방지한다
 * - app.ts는 라우팅/미들웨어 정의, server.ts는 실행 책임만 갖도록 분리
 * - Socket.io를 통한 실시간 채팅 기능 추가
 * ---------------------------------------------------------------------------
 */

/**
 * 서버 시작 전 DB 초기화 및 연결
 * - 1) MySQL 연결이 가능하지 않다면 즉시 프로세스를 중단
 * - 2) 과제 요구사항에 따라 force: true로 테이블을 초기화
 * - 3) 모든 준비가 끝났을 때 Express 서버를 listen
 * - 4) Socket.io 서버 초기화
 */

//const PORT = process.env.PORT;
const PORT = ENV.Port;
async function startServer() {
  try {
    // 1. DB 연결 여부를 확인하여 장애를 조기에 발견
    await connectDB();

    // 2. DB Sync (force: true로 모든 테이블 삭제 후 재생성)
    //
    //    - 실제 서비스에서는 false로 바꾸거나 migration을 사용해야 함
    await syncDatabase();
    startTradeReviewPublicationJob();

    // 3. HTTP 서버 생성 (Express와 Socket.io를 함께 사용하기 위해)
    const httpServer = createServer(app);

    // 4. Socket.io 서버 초기화
    const io = setupSocketIO(httpServer);
    setIO(io); // 전역으로 Socket.io 인스턴스 저장

    // 5. HTTP 서버 시작
    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${ENV.Port}`);
      logger.info(`Socket.io 서버가 활성화되었습니다.`);
      console.log(`Server is running on port ${ENV.Port}`);
      console.log(`Socket.io 서버가 활성화되었습니다.`);
    });
  } catch (error) {
    // 서버를 기동하지 못한 이유를 기록하고 프로세스를 종료한다.
    logger.err("Failed to start server");
    logger.err(error, true);
  }
}

startServer();

/**
 * 주의점 강조 server.ts는 오직 서버 열기만 한다.
 * 라우터나 추가적인 미들웨어는 app.ts의 책임으로 넘겼다.
 *
 * 서버 구성 책임인 app.ts와
 * 서버 구동 책임인 server.ts의 역할을 명확히 분리한다.
 *
 * 환경에 따라 다른 server 파일을 활용할 수 있는점을 고려한다.
 */
