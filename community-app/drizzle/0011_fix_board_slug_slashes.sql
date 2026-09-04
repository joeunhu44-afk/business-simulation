-- Custom SQL migration file, put your code below! --

-- 슬러그 입력 검증이 없던 시절 생성된 게시판 중 슬러그에 '/'가 섞여 들어간
-- 경우(예: "/question") /board/:slug 라우팅이 "/board//question" 같은 잘못된
-- 경로가 되어 404로 이어졌다. '/'를 '-'로 치환하고 앞뒤에 남는 '-'는 정리한다.
UPDATE `boards` SET `slug` = REPLACE(`slug`, '/', '-') WHERE `slug` LIKE '%/%';--> statement-breakpoint
UPDATE `boards` SET `slug` = TRIM(BOTH '-' FROM `slug`) WHERE `slug` LIKE '-%' OR `slug` LIKE '%-';
