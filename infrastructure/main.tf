provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}
data "oci_identity_availability_domains" "available" { compartment_id = var.tenancy_ocid }
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  shape                    = "VM.Standard.A1.Flex"
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}
resource "oci_core_vcn" "web" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "abitetris"
}
resource "oci_core_internet_gateway" "web" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.web.id
  enabled        = true
}
resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.web.id
  route_rules {
    network_entity_id = oci_core_internet_gateway.web.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}
resource "oci_core_security_list" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.web.id
  ingress_security_rules {
    protocol = "6"
    source   = var.ssh_ingress_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }
  egress_security_rules {
    protocol = "all"
    destination = "0.0.0.0/0"
  }
}
resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.web.id
  cidr_block                 = "10.0.0.0/24"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.public.id]
  prohibit_public_ip_on_vnic = false
}
resource "oci_core_instance" "web" {
  compartment_id      = var.compartment_ocid
  availability_domain = coalesce(var.availability_domain, data.oci_identity_availability_domains.available.availability_domains[0].name)
  shape               = "VM.Standard.A1.Flex"
  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_in_gbs
  }
  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = true
  }
  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu.images[0].id
  }
  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }
}
data "oci_core_vnic_attachments" "web" {
  compartment_id = var.compartment_ocid
  instance_id    = oci_core_instance.web.id
}
data "oci_core_vnic" "web" { vnic_id = data.oci_core_vnic_attachments.web.vnic_attachments[0].vnic_id }
