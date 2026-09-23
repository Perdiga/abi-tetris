output "public_ip" { value = data.oci_core_vnic.web.public_ip_address }
output "site_url" { value = "http://${data.oci_core_vnic.web.public_ip_address}" }
