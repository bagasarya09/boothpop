// Isi dengan URL halaman donasi Anda dari BagiBagi, Saweria, atau platform pilihan.
// Tombol disembunyikan sampai URL HTTPS yang valid diisi.
const configuredDonationUrl = 'https://bagibagi.co/BOOTHPOP';
function validDonationUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'&& !url.username && !url.password ? url.href : '';}catch{return '';}}
export const donationUrl=validDonationUrl(configuredDonationUrl);
