variable "tenancy_ocid" {
  type      = string
  sensitive = true
}
variable "user_ocid" {
  type      = string
  sensitive = true
}
variable "fingerprint" {
  type      = string
  sensitive = true
}
variable "private_key_path" {
  type      = string
  sensitive = true
}
variable "region" { type = string }
variable "compartment_ocid" { type = string }
variable "ssh_public_key" { type = string }
variable "ssh_ingress_cidr" {
  type    = string
  default = "0.0.0.0/0"
}
variable "availability_domain" {
  type    = string
  default = null
}
variable "instance_name" {
  type    = string
  default = "abi-tetris-web"
}
variable "ocpus" {
  type    = number
  default = 1
}
variable "memory_in_gbs" {
  type    = number
  default = 6
}
