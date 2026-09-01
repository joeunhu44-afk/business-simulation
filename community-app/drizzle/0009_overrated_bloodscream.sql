-- 좋아요 중복 저장 버그 수정: 레이스 컨디션으로 같은 (postId, userId) / (commentId, userId)
-- 조합이 여러 번 저장되면서 likeCount가 실제 좋아요 행 수와 어긋나, 버튼이 안 눌리는 것처럼
-- 보이던 문제. 먼저 이미 쌓인 중복 행을 정리하고 카운트를 다시 맞춘 뒤, DB 레벨에서 다시는
-- 중복이 생기지 않도록 유니크 제약을 건다.

-- 1) 중복 행 제거 (가장 먼저 생긴 행만 남김)
DELETE pl1 FROM postLikes pl1
INNER JOIN postLikes pl2
WHERE pl1.id > pl2.id AND pl1.postId = pl2.postId AND pl1.userId = pl2.userId;--> statement-breakpoint

DELETE cl1 FROM commentLikes cl1
INNER JOIN commentLikes cl2
WHERE cl1.id > cl2.id AND cl1.commentId = cl2.commentId AND cl1.userId = cl2.userId;--> statement-breakpoint

-- 2) likeCount를 실제 행 수에 맞춰 재계산
UPDATE posts p
SET p.likeCount = (SELECT COUNT(*) FROM postLikes pl WHERE pl.postId = p.id);--> statement-breakpoint

UPDATE comments c
SET c.likeCount = (SELECT COUNT(*) FROM commentLikes cl WHERE cl.commentId = c.id);--> statement-breakpoint

-- 3) 앞으로 중복이 생기지 않도록 유니크 제약 추가
ALTER TABLE `commentLikes` ADD CONSTRAINT `commentLikes_comment_user_unique` UNIQUE(`commentId`,`userId`);--> statement-breakpoint
ALTER TABLE `postLikes` ADD CONSTRAINT `postLikes_post_user_unique` UNIQUE(`postId`,`userId`);
