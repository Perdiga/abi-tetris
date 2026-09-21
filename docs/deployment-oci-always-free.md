# Deploy na OCI Always Free

Este projeto e um SPA estatico gerado pelo Vite. O deploy usa um bucket de
**Object Storage** publico com o recurso **Static Website** da Oracle Cloud
Infrastructure (OCI), que se enquadra na franquia Always Free de Object
Storage. O GitHub Actions valida o projeto e publica `dist/` a cada push para
`main`.

## 1. Criar o bucket na OCI

No Console da OCI:

1. Abra **Storage > Buckets** e crie um bucket no compartment desejado.
   Escolha um nome globalmente unico, por exemplo `abi-tetris-site`.
2. Abra o bucket, entre em **Edit visibility** e selecione **Public**.
3. Em **Static Website Configuration**, habilite o website estatico e defina:
   - Index object: `index.html`
   - Error object: `index.html`
4. Copie o *Namespace* do Object Storage e a URL do website exibida nessa tela.

O bucket precisa estar na mesma regiao indicada no arquivo de configuracao da
CLI abaixo. Nao e necessario criar VM, Load Balancer ou banco de dados.

## 2. Criar identidade de deploy com minimo privilegio

Crie um grupo (por exemplo, `github-oci-deployers`) e um usuario de servico para
o GitHub Actions. Adicione o usuario ao grupo, gere uma API signing key e envie
a chave publica ao usuario no Console da OCI.

Crie a policy abaixo no compartment que contem o bucket. Troque
`<compartment-name>` pelo nome do seu compartment:

```text
Allow group github-oci-deployers to manage objects in compartment <compartment-name>
```

Essa permissao permite enviar e substituir os arquivos do site, mas nao cria
nem remove buckets. Para limitar a um unico bucket, aplique uma policy mais
restritiva conforme as politicas da sua tenancy.

## 3. Configurar secrets do GitHub

No repositorio, abra **Settings > Secrets and variables > Actions** e crie os
seguintes *Repository secrets*:

| Secret | Conteudo |
| --- | --- |
| `OCI_BUCKET_NAME` | Nome do bucket criado no passo 1. |
| `OCI_NAMESPACE` | Namespace do Object Storage. |
| `OCI_CONFIG` | Configuracao abaixo, substituindo todos os valores entre `<...>`. |
| `OCI_API_KEY` | Conteudo integral da chave privada PEM da API signing key. |

Conteudo de `OCI_CONFIG`:

```ini
[DEFAULT]
user=<ocid-do-usuario-de-servico>
fingerprint=<fingerprint-da-api-key>
tenancy=<ocid-da-tenancy>
region=<regiao-do-bucket>
key_file=/home/runner/work/abi-tetris/abi-tetris/.oci/oci_api_key.pem
```

O caminho informado em `key_file` e apenas um valor temporario: o workflow o
substitui pelo caminho correto e efemero do runner antes de executar a CLI.

Tambem e recomendado criar o Environment `production` em **Settings >
Environments** e exigir aprovacao para deployments, se houver mais pessoas com
acesso ao repositorio.

## Fluxo de CI/CD

- Pull requests: `.github/workflows/ci.yml` executa install, lint, testes e
  build.
- Push para `main`: CI e deploy sao executados. O deploy roda as mesmas
  verificacoes antes de publicar os arquivos em `dist/`.
- Execucao manual: use **Actions > Deploy to OCI Object Storage > Run workflow**.

Arquivos com hash do Vite sao publicados novamente quando alteram. Arquivos
antigos podem permanecer no bucket e nao afetam o site; para economizar espaco,
remova-os manualmente apenas depois de confirmar que nenhuma versao anterior
esta em uso.

## Verificacao

Depois do primeiro deploy, abra a URL do Static Website copiada da OCI. O log
da etapa **Publish dist to Object Storage** deve listar os objetos enviados.
