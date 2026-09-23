# Deploy na OCI Always Free

O deploy usa uma VM `VM.Standard.A1.Flex` (1 OCPU, 6 GB RAM), Nginx e Terraform. Esse consumo fica dentro da franquia Always Free (maximo conjunto: 2 OCPUs e 12 GB).

## Infraestrutura

1. Gere uma chave de deploy: `ssh-keygen -t ed25519 -f oci-abi-tetris -C github-deploy`.
2. Em `infrastructure`, crie `terraform.tfvars` local (nao envie ao Git):

```hcl
tenancy_ocid     = "ocid1.tenancy..."
user_ocid        = "ocid1.user..."
fingerprint      = "aa:bb:..."
private_key_path = "C:/caminho/oci_api_key.pem"
region           = "sa-saopaulo-1"
compartment_ocid = "ocid1.compartment..."
ssh_public_key   = "<conteudo de oci-abi-tetris.pub>"
ssh_ingress_cidr = "SEU_IP_PUBLICO/32"
```

3. Execute `terraform init`, `terraform plan` e `terraform apply`. O Dev
   Container do projeto ja inclui Terraform; reabra o container depois desta
   alteracao caso ele ja esteja em execucao.
4. Copie `public_ip` da saida. O site respondera em `site_url`.

Terraform cria VCN, subnet publica, gateway, regras de rede (HTTP e SSH), VM Ubuntu ARM e Nginx. O Nginx usa `index.html` como fallback para rotas da SPA.

## Secrets do GitHub

Depois do `apply`, crie estes secrets em **Settings > Secrets and variables > Actions**:

- `OCI_VM_HOST`: valor de `public_ip`.
- `OCI_VM_DEPLOY_SSH_PRIVATE_KEY`: conteudo completo de `oci-abi-tetris`.
- `OCI_VM_SSH_HOST_KEY`: saida de `ssh-keyscan -H <public_ip>` executada localmente.

O workflow **Deploy to OCI VM** executa testes/build e sincroniza `dist/` com `/var/www/abi-tetris/` por SSH com verificacao estrita da chave do host.

Nunca envie chaves privadas, `terraform.tfvars` ou `terraform.tfstate` ao Git.
