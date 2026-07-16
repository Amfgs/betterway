# Widgets iOS da Better Way

O app já tem a base compartilhada para widgets:

- `GET /api/widgets`: retorna preferências, opções de metas/limites, preview escolhido e streak diário.
- `PUT /api/widgets/preferences`: salva se o widget principal mostra meta ou limite, qual item foi escolhido e se o usuário quer ativar bloqueio nativo às 22:30.
- No app mobile, a configuração fica em `Perfil > Widgets do iPhone`.

## Limite real do Expo Go

Widgets de tela inicial do iPhone não aparecem dentro do Expo Go. Eles precisam de um build iOS nativo, normalmente via EAS Build ou Xcode, porque dependem de WidgetKit/App Extensions.

O pacote oficial `expo-widgets` existe, mas está em alpha e exige development build. Quando o projeto for migrar para esse caminho, o fluxo será:

```bash
npx expo install expo-widgets
npx expo prebuild --clean
eas build --platform ios --profile development
```

Depois disso, crie dois widgets:

- `BetterWayPrimaryWidget`: mostra a meta ou limite selecionado pelo usuário.
- `BetterWayStreakWidget`: mostra o streak diário e chama o usuário para abrir o app antes das 22:30.

## Sobre bloquear outros apps às 22:30

Um app comum não pode bloquear outros apps livremente no iOS. Para fazer isso de verdade, é necessário usar os frameworks de Screen Time da Apple:

- `FamilyControls`
- `DeviceActivity`
- `ManagedSettings`

Esse caminho exige autorização do usuário, entitlements da Apple, App Groups, extensões nativas e revisão da App Store. A Better Way já salva a intenção do usuário, mas o bloqueio real precisa dessa etapa nativa.
