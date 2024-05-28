# KUTRIS - 웹기반 테트리스 게임

## 1. 프로젝트 소개
- 테트리스 게임을 웹에서 즐길 수 있는 서비스입니다.

## 2. 프로젝트 기술 스택
- Frontend: Next.js, React, Tailwind CSS
- Backend: Next.js API, Node.js, Express for socket
- Deployment: Vercel, AWS Lightsail
  
## 3. 프로젝트 기능
- PC환경에서는 키보드로 조작이 가능하며, 모바일 환경에서는 하단에 버튼을 통해 조작이 가능합니다.
- 싱글 플레이 모드 및 멀티 플레이 모드를 지원합니다.
- 멀티 플레이는 랜덤매칭과 초대 매칭을 지원합니다.
- 랜덤매칭은 대기실에서 다른 사용자를 기다리며 매칭이 되며, 초대 매칭은 초대 링크(코드)를 통해 매칭이 됩니다.
- 게임 결과는 따로 기록하지 않으며, 게임이 오버되면 기록 표시와 함께 게임이 종료됩니다.

## 4. 프로젝트 구조 및 설명
### 소켓 서버 분리
- Next.js를 사용하여 소켓서버를 구현할 수 있지만, 배포환경이 vercel인 경우 serverless로 동작하기 때문에 소켓서버를 별도로 구현하였습니다.
  - 게임 클라이언트에서 사용자가 게임서버를 선택해서 접속할 수 있듯이, 사용자가 많아질경우 소켓서버를 여러개 가동하여 사용자를 분산시킬 수 있게 하기 위함
  - vercel에서는 소켓서버를 지원 X (https://vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections)
- AWS Lightsail을 사용하여 소켓서버를 구현하였으며, vercel에서 도메인에 SSL을 적용하여 연결해주기 때문에 소켓서버를 연결할 때에도 SSL을 적용해야 합니다. (wss://~~)
  - Recent version of Browser prohibits active mixed content. (https://web.dev/articles/what-is-mixed-content?hl=ko#active_mixed_content)
  - Lightsail 인스턴스가 재시작되어 IP가 변경되는 것을 방지하기 위해, static IP를 신청하여 적용하였습니다.
  - 도메인이 없으면 SSL을 적용할 수 없기 때문에, 기존 보유중인 도메인의 서브도메인을 사용하였습니다. (kutrisserver.hjhj.kr - A record to Lightsail static IP)
- AWS Lightsail 인스턴스에서 ubuntu OS를 사용하였으며, python3-certbox-nginx를 통해 무료 SSL을 적용하였고 도메인을 연결하였습니다.
- 인스턴스 내에서 소켓서버를 3001번 포트로 pm2를 통해 실행하였으며, nginx를 통해 외부에서 접속할 수 있도록 설정하였습니다.
  - 소켓서버 코드 : socket/index.js
  - Nginx 셋팅 코드 (default파일) : socket/site-availble/default

### 프로젝트 배포 자동화 
- 기본적으로 vercel에 github respotiory를 연결하여 배포가 이루어지지만, 소켓서버는 AWS Lightsail에 배포되기 때문에 github action을 통해 소켓서버 배포 자동화를 구현하였습니다.
  - .github/workflows/socketserver_deploy.yml
  - 해당 github action은 main branch에 push가 되면 실행되며, AWS Lightsail에 접속하여 업데이트된 소켓서버 코드를 pull하고 pm2를 통해 재시작합니다.
  


## 5. 프로젝트 실행 
- Frontend
  ```bash
  npm install
  npm run dev
  ```
- Backend (socket server)
  ```bash
  npm run dd
  ```
