# GitHub Pages 배포

Alcazar를 APK 없이 모바일 브라우저에서 플레이하게 만드는 가장 짧은 배포 경로다.

## 준비

1. GitHub에 `alcazar` 저장소를 만든다.
2. 이 프로젝트를 `main` 브랜치로 push한다.
3. GitHub 저장소에서 `Settings` → `Pages` → `Build and deployment` → `Source`를 `GitHub Actions`로 고른다.

저장소를 비워서 만들었다면 아래 명령으로 검증, 커밋, 원격 연결, push를 한 번에 진행할 수 있다.

```powershell
npm run pages:publish -- --repo https://github.com/깃허브아이디/alcazar --name "커밋이름" --email "커밋이메일"
```

## 자동 배포

`.github/workflows/github-pages.yml`가 `main` 브랜치 push 때마다 실행된다.

워크플로가 자동으로 정하는 값:

- 일반 저장소: `https://깃허브아이디.github.io/저장소이름/`
- `<아이디>.github.io` 저장소: `https://아이디.github.io/`

## 로컬 검증

저장소 이름이 `alcazar`라면 아래 명령으로 GitHub Pages와 같은 경로 조건에서 정적 빌드와 링크를 확인한다.

```powershell
npm run pages:check
```

직접 경로를 바꿔 확인하고 싶으면 아래처럼 실행한다.

```powershell
$env:GITHUB_PAGES='true'; $env:NEXT_PUBLIC_BASE_PATH='/alcazar'; $env:NEXT_PUBLIC_SITE_URL='https://깃허브아이디.github.io/alcazar'; npm run build
```

성공하면 `out/` 폴더가 만들어진다. GitHub Actions는 이 `out/` 폴더를 GitHub Pages에 올린다.

## 모바일 플레이

배포 후 휴대폰에서 GitHub Pages 주소를 열면 바로 플레이할 수 있다. 브라우저 메뉴에서 홈 화면에 추가하면 앱 아이콘처럼 실행할 수 있다.
