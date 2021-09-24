# aloto Temporary server

# usage

1. CLIENT_URL이라는 환경변수를 .env에 저장 후 사용(for CORS)
2. package.json에서 NODE_ENV 환경변수값이 dev, prod 에따라 조건 실행
3. NODE_ENV의 상태가 dev인가 prod인가에 따라 CLIENT의 주소를 사용할지(배포모드) 아니면 localhost:3000(개발모드)을 사용할지 결정

# apply to babel-node

# config nodemon

# 고도화 정도에따라 파일 번들링 예정

(기능 병합 예정)

# @socket.io/admin-ui 적용

- socket 접속 현황 및 room 생성 현황을 실시간으로 모니터링 할수있는 기능
- usage
  ref: https://admin.socket.io/#/
  접속후 설정값에 (백엔드주소/admin) 입력후 확인 누르면 admin 창 나옴

# admin또한 socketToRoom에 현황이 남음 admin은 socketToRoom에 안들어가게 설정

# socketToRoom은 client가 방을 만들었을때의 현황 내용만 저장되게 조건을 설정한다.
